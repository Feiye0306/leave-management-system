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

// Simple check for config presence
const isConfigConfigured = !!firebaseConfig.apiKey;

let app: any;
let db: any;

try {
    if (isConfigConfigured) {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    } else {
        console.warn('⚠️ Firebase Config missing in .env. Service will not function correctly.');
    }
} catch (error) {
    console.error('❌ Firebase Initialization Error:', error);
}

// Collection References
const EMPLOYEES_COL = 'employees';
const LEAVES_COL = 'leaves';
const METADATA_COL = 'metadata';
const AUDIT_LOGS_COL = 'audit_logs';

export class FirebaseService implements ILeaveService {

    // --- Employee ---
    async getEmployees(): Promise<Employee[]> {
        const snapshot = await getDocs(collection(db, EMPLOYEES_COL));
        return snapshot.docs.map(doc => doc.data() as Employee);
    }

    async getEmployee(id: string): Promise<Employee | undefined> {
        // In Firestore, we can get by ID if we use it as doc ID.
        // Assuming we save employee with their ID as doc ID.
        // If not, we query. Let's assume we use setDoc(doc(db, col, id), data).
        // But for safety, let's query the specific doc.
        // Actually, we should probably implement getDoc.
        // For now, let's stick to the interface which implies getting from the list or by ID.
        // Let's implement get by ID using the collection query to be safe if ids are not doc ids, 
        // but robust implementation should use doc IDs.
        // Let's assume we use employee.id as doc ID.
        const snapshot = await getDocs(query(collection(db, EMPLOYEES_COL), where('id', '==', id)));
        if (snapshot.empty) return undefined;
        return snapshot.docs[0].data() as Employee;
    }

    async saveEmployee(employee: Employee): Promise<void> {
        await setDoc(doc(db, EMPLOYEES_COL, employee.id), employee);

        // Auto-add branch
        if (employee.branch) {
            await this.addBranch(employee.branch);
        }
    }

    async deleteEmployee(id: string): Promise<void> {
        await deleteDoc(doc(db, EMPLOYEES_COL, id));
    }

    // --- Leaves ---
    async getLeaves(filters?: { branch?: string; employeeId?: string; startDate?: string; endDate?: string }): Promise<LeaveRecord[]> {
        let q = query(collection(db, LEAVES_COL));

        if (filters) {
            if (filters.branch && filters.branch !== '全部分校') {
                q = query(q, where('branch', '==', filters.branch));
            }
            if (filters.employeeId) {
                q = query(q, where('employeeId', '==', filters.employeeId));
            }
            // Firestore composite indexes might be needed for multiple fields.
            // Date filtering is skipped for now to match LocalStorage logic (client-side or simple).
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => d.data() as LeaveRecord);
    }

    async addLeave(leave: LeaveRecord): Promise<void> {
        await setDoc(doc(db, LEAVES_COL, leave.id), leave);
    }

    async updateLeave(leave: LeaveRecord): Promise<void> {
        await setDoc(doc(db, LEAVES_COL, leave.id), leave, { merge: true });
    }

    async deleteLeave(id: string): Promise<void> {
        await deleteDoc(doc(db, LEAVES_COL, id));
    }

    // --- Branches ---
    async getBranches(): Promise<string[]> {
        const docRef = doc(db, METADATA_COL, 'branches');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data().list || [];
        }
        return [];
    }

    async addBranch(branch: string): Promise<void> {
        const docRef = doc(db, METADATA_COL, 'branches');
        const docSnap = await getDoc(docRef);
        let list: string[] = [];

        if (docSnap.exists()) {
            list = docSnap.data().list || [];
        }

        if (!list.includes(branch)) {
            list.push(branch);
            await setDoc(docRef, { list });
        }
    }

    async removeBranch(branch: string): Promise<void> {
        const docRef = doc(db, METADATA_COL, 'branches');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            let list = docSnap.data().list || [];
            list = list.filter((b: string) => b !== branch);
            await setDoc(docRef, { list });
        }
    }

    // --- Audit Logs ---
    async getAuditLogs(filters?: { employeeId?: string }): Promise<AuditLog[]> {
        let q = query(collection(db, AUDIT_LOGS_COL));
        if (filters?.employeeId) {
            q = query(q, where('employeeId', '==', filters.employeeId));
        }
        const snapshot = await getDocs(q);
        // Sorting usually requires an index, but let's do in-memory sort if data is small, 
        // or just return as is. The viewer likely sorts it.
        return snapshot.docs.map(d => d.data() as AuditLog);
    }

    async addAuditLog(log: AuditLog): Promise<void> {
        await setDoc(doc(db, AUDIT_LOGS_COL, log.id), log);
    }

    // --- Utils ---
    async resetData(): Promise<void> {
        // Dangerous: Deletes all. 
        // In Firestore, we should use batch.
        const batch = writeBatch(db);

        // This is not scalable for large datasets, but fine for small.
        const clearCol = async (colName: string) => {
            const snapshot = await getDocs(collection(db, colName));
            snapshot.docs.forEach(d => batch.delete(d.ref));
        };

        await clearCol(EMPLOYEES_COL);
        await clearCol(LEAVES_COL);
        await clearCol(AUDIT_LOGS_COL);
        await deleteDoc(doc(db, METADATA_COL, 'branches'));

        await batch.commit();
    }

    async generateSampleData(): Promise<void> {
        const batch = writeBatch(db);

        const mkEmployee = (id: string, name: string, branch: string, status: '在職' | '離職', hireDate: string, birthDate: string, usedLeave: number, personalUsed: number, quota: number): Employee => {
            const { entitlement, expiry } = calculateAnnualLeave(hireDate);
            return {
                id, name, branch, status, hireDate, birthDate,
                annualLeave: { initial: entitlement, earned: 0, adjustment: 0, used: usedLeave, expiry },
                personalLeave: { initial: 0, earned: quota * 3, adjustment: 0, used: personalUsed }, // Assume 3 months accrued for sample
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
            // Add a birthday for current month (Feb/March based on current time? Time is Feb 2026)
            // Current Time: 2026-02-16. So let's add someone with Feb birthday.
            mkEmployee('emp008', '快樂壽星', '信義校', '在職', '2024-01-01', '2000-02-18', 0, 0, 4),
        ];

        sampleEmployees.forEach(emp => {
            const ref = doc(db, EMPLOYEES_COL, emp.id);
            batch.set(ref, emp);
        });

        // Branches
        const branchSet = new Set<string>();
        sampleEmployees.forEach(emp => branchSet.add(emp.branch));
        const branchRef = doc(db, METADATA_COL, 'branches');
        batch.set(branchRef, { list: Array.from(branchSet) });

        await batch.commit();
    }
}
