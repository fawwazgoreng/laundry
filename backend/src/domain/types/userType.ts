export type registerType = {
    username: String
    email: String
    password: String
    phone: String
}

export type loginType = {
    email: String
    password: String
}

export interface userType {
    id: String
    username: String
    email: String
    role : "admin" | "user"
    phone : String
    is_verified : Boolean
}


export type addressType = {
    label: String
    address_text: String
    latitude: Number
    longtitude: Number 
    is_primary: Boolean
    user_id: String
}

