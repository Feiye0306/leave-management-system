import { FirebaseService } from './FirebaseService';
import type { ILeaveService } from './LeaveService';

// Singleton instance
export const leaveService: ILeaveService = new FirebaseService();
