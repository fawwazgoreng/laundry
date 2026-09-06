import type { userType } from "../domain/types/userType";

export interface AppVariables {
    requestId: string
    user: userType
    userId: string
}