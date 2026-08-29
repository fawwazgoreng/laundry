import { password } from "bun";
import { loginType } from "../types/userType";
import  * as z from 'zod';

export class userEntity {
    constructor (
        username: String,
        email: String,
        role: 'admin' | 'user'
    ) {}
    private validateLogin (req: loginType) {
        const validate = z.object({
            username: z.string().max(100),
            password: z.string().regex(/[A-Z]/ , {
                message: "password must contain uppercase"
            }).regex(/[0-9]/ , {
                message: "password must contain at least 1 number"
            }).min(6).max(100)
        });
        validate 
    }
    protected throwError() {
        
    };
    
}