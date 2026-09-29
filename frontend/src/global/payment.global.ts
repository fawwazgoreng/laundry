export interface SnapResult {
    status_code?: string
    status_message?: string
    transaction_id?: string
    order_id?: string
    payment_type?: string
    transaction_time?: string
    fraud_status?: string
    gross_amount?: string
    va_numbers?: Array<{ bank: string; va_number: string }>
    [key: string]: unknown
}

export interface SnapPaymentOptions {
    onSuccess?: (result: SnapResult) => void
    onPending?: (result: SnapResult) => void
    onError?: (result: SnapResult) => void
    onClose?: () => void
}

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options?: SnapPaymentOptions) => void
    }
  }
}