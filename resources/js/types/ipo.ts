import type { User } from './auth';

export interface UserPan {
    id: number;
    user_id: number;
    pan_number: string;
    masked_pan: string;
    account_holder_name?: string | null;
    broker_name?: string | null;
    notes?: string | null;
    verification_status: 'unverified' | 'format_valid' | 'verified';
    status: 'active' | 'inactive';
    created_at: string;
    updated_at: string;
    user?: User;
}

export interface IpoRate {
    id: number;
    ipo_id: number;
    trader_rate: number | string;
    published_rate: number | string;
    margin: number | string;
    effective_from?: string | null;
    is_active: boolean;
    note?: string | null;
    created_by_user_id?: number | null;
    created_at: string;
    updated_at: string;
    creator?: User;
}

export interface Ipo {
    id: number;
    company_name: string;
    symbol?: string | null;
    exchange: string;
    ipo_type: 'mainboard' | 'sme';
    category?: string | null;
    open_date?: string | null;
    close_date?: string | null;
    allotment_date?: string | null;
    listing_date?: string | null;
    price_band_min?: number | string | null;
    price_band_max?: number | string | null;
    issue_price?: number | string | null;
    lot_size: number;
    min_retail_qty?: number | null;
    issue_size?: number | string | null;
    gmp?: number | string | null;
    accept_fix_applications?: boolean;
    auto_approve_fix?: boolean;
    kfin_client_id?: string | null;
    status: 'upcoming' | 'open' | 'closed' | 'allotted' | 'listed';
    provider: string;
    provider_id?: string | null;
    last_synced_at?: string | null;
    allotment_scraped_at?: string | null;
    created_at: string;
    updated_at: string;
    active_rate?: IpoRate | null;
    rates?: IpoRate[];
    application_batches_count?: number;
    total_applications_count?: number;
    total_subscription?: string | null;
    face_value?: string | number | null;
    isin?: string | null;
    drhp_url?: string | null;
    rhp_url?: string | null;
    refund_date?: string | null;
    mandate_end_date?: string | null;
    bidding_hours?: string | null;
    registrar_info?: {
        name?: string;
        email?: string;
        contact_name?: string;
        contact_number?: string;
        website?: string;
        registrar?: string;
    } | null;
    raw_provider_data?: any;
}

export interface ApplicationBatchPan {
    id: number;
    application_batch_id: number;
    user_pan_id: number;
    sequence_number: number;
    pan_number_snapshot: string;
    allotment_status: 'pending' | 'allotted' | 'not_allotted';
    allotted_shares: number;
    notes?: string | null;
    user_pan?: UserPan;
}

export interface Settlement {
    id: number;
    application_batch_id: number;
    settlement_date: string;
    actual_gross_profit: number | string;
    actual_user_payout: number | string;
    actual_net_earnings: number | string;
    capital_returned: number | string;
    settlement_method: string;
    notes?: string | null;
    settled_by_user_id?: number | null;
    created_at: string;
    updated_at: string;
    settled_by?: User;
}

export interface UserUpi {
    id: number;
    user_id?: number | null;
    bank_account_id?: number | null;
    upi_id: string;
    upi_app: string;
    status: 'active' | 'archived';
    created_at: string;
    updated_at: string;
    bank_account?: BankAccount;
}

export interface BankAccount {
    id: number;
    user_id?: number | null;
    bank_name: string;
    account_holder_name?: string | null;
    status: 'active' | 'archived';
    created_at: string;
    updated_at: string;
    upis?: UserUpi[];
}

export interface ApplicationBatch {
    id: number;
    batch_number: string;
    ipo_id: number;
    user_id: number;
    applicant_name?: string | null;
    bank_name?: string | null;
    pan_number?: string | null;
    upi_id?: string | null;
    upi_app?: string | null;
    rate_id?: number | null;
    application_count: number;
    funding_source: 'my_money' | 'user_money';
    profit_sharing_type?: 'fix' | 'percentage' | 'rate_margin' | null;
    profit_sharing_value?: number | string | null;
    trader_rate_snapshot: number | string;
    published_rate_snapshot: number | string;
    margin_snapshot: number | string;
    gmp_snapshot?: number | string | null;
    ipo_amount?: number | string | null;
    capital_per_application: number | string;
    capital_amount: number | string;
    expected_gross_profit: number | string;
    expected_user_payout: number | string;
    expected_net_earnings: number | string;
    settled_gross_profit?: number | string | null;
    settled_user_payout?: number | string | null;
    settled_net_earnings?: number | string | null;
    capital_returned?: number | string | null;
    application_status:
        | 'draft'
        | 'ready'
        | 'submitted'
        | 'confirmed'
        | 'pending_approval'
        | 'pending_allotment'
        | 'allotted'
        | 'not_allotted'
        | 'cancelled';
    settlement_status: 'estimated' | 'partially_settled' | 'settled' | 'cancelled';
    trader_reference?: string | null;
    submission_date?: string | null;
    notes?: string | null;
    allotment_details?: {
        kfin_client_id?: string;
        kfin_ipo_name?: string;
        application_number?: string;
        name_from_pan?: string;
        applied_shares?: number;
        allotted_shares?: number;
        dp_clid?: string;
        pan_masked?: string;
        allotted?: boolean;
        checked_at?: string;
    } | null;
    allotment_checked_at?: string | null;
    created_by_user_id?: number | null;
    created_at: string;
    updated_at: string;
    ipo?: Ipo;
    user?: User;
    rate?: IpoRate;
    batch_pans?: ApplicationBatchPan[];
    settlement?: Settlement | null;
}

export interface AuditLog {
    id: number;
    user_id?: number | null;
    action: string;
    auditable_type?: string | null;
    auditable_id?: number | null;
    old_values?: Record<string, unknown> | null;
    new_values?: Record<string, unknown> | null;
    description?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    created_at: string;
    user?: User;
}

export interface SyncLog {
    id: number;
    provider: string;
    status: 'success' | 'failed' | 'partial';
    ipos_created: number;
    ipos_updated: number;
    error_message?: string | null;
    execution_time_ms: number;
    triggered_by_user_id?: number | null;
    created_at: string;
    triggered_by?: User;
}
