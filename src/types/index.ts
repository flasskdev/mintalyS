export interface User {
  id: number;
  name: string;
  email: string;
  email_verified: number;
  hwid: string | null;
  hwid_reset_at: string | null;
  hwid_reset_count: number;
  sub_id: number | null;
  sub_to: string | null;
  banned: number;
  ban_reason: string | null;
  banned_at: string | null;
  dev: number;
  seller: number;
  forum_banned: number;
  balance: number;
  token: string | null;
  last_login_at: string | null;
  last_ip: string | null;
  created_at: string;
  updated_at: string;
  sub_active?: boolean;
  sub_days_left?: number;
}

export interface AuthResponse {
  success: boolean;
  status: 'success' | 'error';
  message: string;
  id?: number;
  email?: string;
  hwid?: string | null;
  token?: string;
  sub_to?: string | null;
  banned?: number;
  dev?: number;
  sub_id?: number | null;
  sub_active?: boolean;
  sub_days_left?: number;
  balance?: number;
  two_factor_required?: boolean;
  requires_verification?: boolean;
  data?: { user: User };
}

export interface Subscription {
  id: number;
  name: string;
  description: string;
  sub_days: number;
  cost: number;
  original_cost?: number;
  final_cost?: number;
  discount: number;
  discount_to: string | null;
  discount_active?: boolean;
  subs_value: number;
  is_visible?: number;
  is_popular?: number;
  sort_order?: number;
}

export interface News {
  id: number;
  title: string;
  short_desc: string;
  content: string;
  author_id: number | null;
  is_published: number;
  is_pinned: number;
  views: number;
  comments_count?: number;
  author?: { name: string; id: number };
  created_at: string;
  updated_at: string;
}

export interface NewsComment {
  id: number;
  news_id: number;
  user_id: number;
  content: string;
  is_deleted: number;
  created_at: string;
  updated_at?: string;
  is_edited?: boolean;
  user?: { name: string; id: number };
}

export interface ForumCategory {
  id: number;
  name: string;
  description: string;
  sort_order: number;
  min_sub_required: number;
  is_locked: number;
  created_at: string;
}

export interface ForumThread {
  id: number;
  category_id: number;
  user_id: number;
  title: string;
  content: string;
  is_pinned: number;
  is_locked: number;
  is_deleted: number;
  views: number;
  posts_count: number;
  last_post_at: string | null;
  created_at: string;
  updated_at: string;
  user?: { name: string; id: number };
  category?: ForumCategory;
}

export interface ForumPost {
  id: number;
  thread_id: number;
  user_id: number;
  content: string;
  is_deleted: number;
  created_at: string;
  updated_at: string;
  is_edited?: boolean;
  user?: { name: string; id: number };
}

export interface Ticket {
  id: number;
  user_id: number;
  subject: string;
  category: 'general' | 'payment' | 'technical' | 'ban' | 'other';
  status: 'open' | 'answered' | 'waiting' | 'closed';
  priority: 'low' | 'normal' | 'high';
  last_reply_at: string | null;
  last_reply_staff: number;
  last_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: number;
  ticket_id: number;
  user_id: number;
  is_staff: number;
  message: string;
  created_at: string;
  user_name?: string | null;
  user?: { name: string; id: number };
}

export interface Download {
  id: number;
  title: string;
  version: string;
  filename: string;
  filesize: number;
  sha256: string | null;
  changelog: string | null;
  is_active: number;
  created_at: string;
}

/** `Download` plus the admin-only state of the file on the server. */
export interface AdminDownload extends Download {
  file_exists: boolean;
}

export interface LicenseKey {
  id: number;
  key_code: string;
  sub_id: number;
  days_override: number | null;
  note: string | null;
  created_by: number | null;
  used_by: number | null;
  used_at: string | null;
  used_ip: string | null;
  is_disabled: number;
  created_at: string;
}

export interface EmailCode {
  id: number;
  user_id: number | null;
  email: string;
  code: string;
  purpose: 'verify' | 'password_reset' | 'email_change';
  payload: string | null;
  attempts: number;
  used: number;
  ip: string | null;
  expires_at: string;
  created_at: string;
}

export interface Order {
  id: number;
  user_id: number;
  sub_id: number;
  sub_name: string;
  days: number;
  amount: number;
  discount: number;
  method: 'balance' | 'key' | 'manual' | 'external';
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  forum_open: string;
  hwid_reset_days: string;
  maintenance: string;
  redeem_cooldown_minutes: string;
  refund_text: string;
  registration_open: string;
  site_name: string;
  terms_text: string;
}

export interface ApiResponse<T = unknown> {  success: boolean;
  status: 'success' | 'error';
  message: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}