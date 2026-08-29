import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    getDocs,
    getDoc,
    doc,
    setDoc,
    deleteDoc,
    query,
    where,
    writeBatch
} from 'firebase/firestore';
import type { ILeaveService } from './LeaveService';
import type { Employee, LeaveRecord, AuditLog } from '../types';
import { calculateAnnualLeave } from '../utils/leaveUtils';
import { LocalStorageRepo } from './LocalStorageRepo';

// Helper: 移除所有 undefined 鍵值，防止 Firestore setDoc 拋錯
function cleanForFirestore<T>(data: T): T {
    return JSON.parse(JSON.stringify(data));
}

// Helper: 為 Promise 加上超時控制
function withTimeout<T>(promise: Promise<T>, ms: number = 3000): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Operation timed out after ${ms}ms`));
        }, ms);
        promise
            .then(res => {
                clearTimeout(timer);
                resolve(res);
            })
            .catch(err => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

// Initialize Firebase
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const isConfigConfigured = !!firebaseConfig.apiKey;

let app: any;
let db: any;

try {
    if (isConfigConfigured) {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    }
} catch (error) {
    console.warn('⚠️ Firebase Initialization Notice:', error);
}

// Collection References
const EMPLOYEES_COL = 'employees';
const LEAVES_COL = 'leaves';
const METADATA_COL = 'metadata';
const AUDIT_LOGS_COL = 'audit_logs';

export class FirebaseService implements ILeaveService {
    private localFallback: LocalStorageRepo = new LocalStorageRepo();

    // --- Employee ---
    async getEmployees(): Promise<Employee[]> {
        if (db) {
            try {
                const snapshot = await withTimeout(getDocs(collection(db, EMPLOYEES_COL)), 3500);
                const list = snapshot.docs.map(d => d.data() as Employee);
                if (list.length > 0) {
                    // 同步到 LocalStorage 作為快取
                    list.forEach(emp => this.localFallback.saveEmployee(emp));
                    return list;
                }
            } catch (err) {
                console.warn('Firestore getEmployees fallback to local:', err);
            }
        }
        return this.localFallback.getEmployees();
    }

    async getEmployee(id: string): Promise<Employee | undefined> {
        if (db) {
            try {
                const snapshot = await withTimeout(getDocs(query(collection(db, EMPLOYEES_COL), where('id', '==', id))), 3000);
                if (!snapshot.empty) return snapshot.docs[0].data() as Employee;
            } catch (err) {
                console.warn('Firestore getEmployee fallback to local:', err);
            }
        }
        return this.localFallback.getEmployee(id);
    }

    async saveEmployee(employee: Employee): Promise<void> {
        // 本地雙寫確保即時更新
        await this.localFallback.saveEmployee(employee);

        if (db) {
            try {
                const cleaned = cleanForFirestore(employee);
                await withTimeout(setDoc(doc(db, EMPLOYEES_COL, employee.id), cleaned), 3500);
                if (employee.branch) {
                    await this.addBranch(employee.branch);
                }
            } catch (err) {
                console.warn('Firestore saveEmployee offline/fallback:', err);
            }
        }
    }

    async deleteEmployee(id: string): Promise<void> {
        await this.localFallback.deleteEmployee(id);

        if (db) {
            try {
                await withTimeout(deleteDoc(doc(db, EMPLOYEES_COL, id)), 3000);
            } catch (err) {
                console.warn('Firestore deleteEmployee fallback:', err);
            }
        }
    }

    // --- Leaves ---
    async getLeaves(filters?: { branch?: string; employeeId?: string; startDate?: string; endDate?: string }): Promise<LeaveRecord[]> {
        if (db) {
            try {
                let q = query(collection(db, LEAVES_COL));
                if (filters?.branch && filters.branch !== '全部分校') {
                    q = query(q, where('branch', '==', filters.branch));
                }
                if (filters?.employeeId) {
                    q = query(q, where('employeeId', '==', filters.employeeId));
                }
                const snapshot = await withTimeout(getDocs(q), 3500);
                const list = snapshot.docs.map(d => d.data() as LeaveRecord);
                if (list.length > 0) {
                    return list;
                }
            } catch (err) {
                console.warn('Firestore getLeaves fallback to local:', err);
            }
        }
        return this.localFallback.getLeaves(filters);
    }

    async addLeave(leave: LeaveRecord): Promise<void> {
        await this.localFallback.addLeave(leave);

        if (db) {
            try {
                const cleaned = cleanForFirestore(leave);
                await withTimeout(setDoc(doc(db, LEAVES_COL, leave.id), cleaned), 3000);
            } catch (err) {
                console.warn('Firestore addLeave fallback:', err);
            }
        }
    }

    async updateLeave(leave: LeaveRecord): Promise<void> {
        await this.localFallback.updateLeave(leave);

        if (db) {
            try {
                const cleaned = cleanForFirestore(leave);
                await withTimeout(setDoc(doc(db, LEAVES_COL, leave.id), cleaned, { merge: true }), 3000);
            } catch (err) {
                console.warn('Firestore updateLeave fallback:', err);
            }
        }
    }

    async deleteLeave(id: string): Promise<void> {
        await this.localFallback.deleteLeave(id);

        if (db) {
            try {
                await withTimeout(deleteDoc(doc(db, LEAVES_COL, id)), 3000);
            } catch (err) {
                console.warn('Firestore deleteLeave fallback:', err);
            }
        }
    }

    // --- Branches ---
    async getBranches(): Promise<string[]> {
        if (db) {
            try {
                const docRef = doc(db, METADATA_COL, 'branches');
                const docSnap = await withTimeout(getDoc(docRef), 3000);
                if (docSnap.exists()) {
                    const list = docSnap.data().list || [];
                    if (list.length > 0) return list;
                }
            } catch (err) {
                console.warn('Firestore getBranches fallback to local:', err);
            }
        }
        const localBranches = await this.localFallback.getBranches();
        if (localBranches.length === 0) {
            return ['信義校', '南港校'];
        }
        return localBranches;
    }

    async addBranch(branch: string): Promise<void> {
        await this.localFallback.addBranch(branch);

        if (db) {
            try {
                const docRef = doc(db, METADATA_COL, 'branches');
                const docSnap = await getDoc(docRef);
                let list: string[] = [];
                if (docSnap.exists()) {
                    list = docSnap.data().list || [];
                }
                if (!list.includes(branch)) {
                    list.push(branch);
                    await withTimeout(setDoc(docRef, { list }), 3000);
                }
            } catch (err) {
                console.warn('Firestore addBranch fallback:', err);
            }
        }
    }

    async removeBranch(branch: string): Promise<void> {
        await this.localFallback.removeBranch(branch);

        if (db) {
            try {
                const docRef = doc(db, METADATA_COL, 'branches');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    let list = docSnap.data().list || [];
                    list = list.filter((b: string) => b !== branch);
                    await withTimeout(setDoc(docRef, { list }), 3000);
                }
            } catch (err) {
                console.warn('Firestore removeBranch fallback:', err);
            }
        }
    }

    // --- Audit Logs ---
    async getAuditLogs(filters?: { employeeId?: string }): Promise<AuditLog[]> {
        if (db) {
            try {
                let q = query(collection(db, AUDIT_LOGS_COL));
                if (filters?.employeeId) {
                    q = query(q, where('employeeId', '==', filters.employeeId));
                }
                const snapshot = await withTimeout(getDocs(q), 3500);
                const list = snapshot.docs.map(d => d.data() as AuditLog);
                if (list.length > 0) return list;
            } catch (err) {
                console.warn('Firestore getAuditLogs fallback:', err);
            }
        }
        return this.localFallback.getAuditLogs(filters);
    }

    async addAuditLog(log: AuditLog): Promise<void> {
        await this.localFallback.addAuditLog(log);

        if (db) {
            try {
                const cleaned = cleanForFirestore(log);
                await withTimeout(setDoc(doc(db, AUDIT_LOGS_COL, log.id), cleaned), 3000);
            } catch (err) {
                console.warn('Firestore addAuditLog fallback:', err);
            }
        }
    }

    // --- Utils ---
    async resetData(): Promise<void> {
        await this.localFallback.resetData();

        if (db) {
            try {
                const batch = writeBatch(db);
                const clearCol = async (colName: string) => {
                    const snapshot = await getDocs(collection(db, colName));
                    snapshot.docs.forEach(d => batch.delete(d.ref));
                };
                await clearCol(EMPLOYEES_COL);
                await clearCol(LEAVES_COL);
                await clearCol(AUDIT_LOGS_COL);
                await deleteDoc(doc(db, METADATA_COL, 'branches'));
                await withTimeout(batch.commit(), 4000);
            } catch (err) {
                console.warn('Firestore resetData fallback:', err);
            }
        }
    }

    async generateSampleData(): Promise<void> {
        await this.localFallback.generateSampleData();

        if (db) {
            try {
                const batch = writeBatch(db);
                const mkEmployee = (id: string, name: string, branch: string, status: '在職' | '離職', hireDate: string, birthDate: string, usedLeave: number, personalUsed: number, quota: number): Employee => {
                    const { entitlement, expiry } = calculateAnnualLeave(hireDate);
                    return {
                        id, name, branch, status, hireDate, birthDate,
                        annualLeave: { initial: entitlement, earned: 0, adjustment: 0, used: usedLeave, expiry },
                        personalLeave: { initial: 0, earned: quota * 3, adjustment: 0, used: personalUsed },
                        monthlyPersonalQuota: quota,
                    };
                };

                const sampleEmployees: Employee[] = [
                    mkEmployee('emp001', '王小明', '信義校', '在職', '2023-01-15', '1990-05-20', 3, 2, 4),
                    mkEmployee('emp002', '李美華', '信義校', '在職', '2022-06-01', '1988-11-12', 5, 3, 6),
                    mkEmployee('emp003', '張志強', '南港校', '在職', '2024-09-01', '1995-02-28', 0, 0, 4),
                    mkEmployee('emp004', '陳雅婷', '南港校', '在職', '2021-03-10', '1992-08-15', 8, 5, 8),
                    mkEmployee('emp005', '林建宏', '信義校', '離職', '2020-01-01', '1985-12-01', 0, 0, 4),
                    mkEmployee('emp006', '黃淑芬', '南港校', '在職', '2023-11-20', '1998-03-10', 1, 0, 5),
                    mkEmployee('emp007', '吳俊傑', '信義校', '在職', '2019-05-01', '1991-07-22', 5, 4, 6),
                    mkEmployee('emp008', '快樂壽星', '信義校', '在職', '2024-01-01', '2000-08-18', 0, 0, 4),
                ];

                sampleEmployees.forEach(emp => {
                    const ref = doc(db, EMPLOYEES_COL, emp.id);
                    batch.set(ref, cleanForFirestore(emp));
                });

                const branchSet = new Set<string>();
                sampleEmployees.forEach(emp => branchSet.add(emp.branch));
                const branchRef = doc(db, METADATA_COL, 'branches');
                batch.set(branchRef, { list: Array.from(branchSet) });

                await withTimeout(batch.commit(), 4000);
            } catch (err) {
                console.warn('Firestore generateSampleData fallback:', err);
            }
        }
    }
}

