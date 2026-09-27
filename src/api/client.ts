import type {
  User,
  AuthResponse,
  Subscription,
  News,
  NewsComment,
  ForumCategory,
  ForumThread,
  ForumPost,
  Ticket,
  TicketMessage,
  Download,
  AdminDownload,
  LicenseKey,
  Order,
  Settings,
  ApiResponse,
  PaginatedResponse,
} from '../types';

// Empty value means "same origin" (the Express server serves both API and frontend).
const rawApiUrl = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
const isLocalhostHost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === ''
);
// In production or when accessed via public domain/IP, never point API requests to client's localhost
const API_BASE_URL = (!isLocalhostHost && rawApiUrl.includes('localhost')) ? '' : rawApiUrl;

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private buildUrl(endpoint: string, params?: Record<string, string>): string {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const origin = this.baseUrl || window.location.origin;
    const url = new URL(`${origin}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    return url.toString();
  }

  private async request<T = ApiResponse>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers, ...fetchOptions } = options;

    const requestHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.token) {
      (requestHeaders as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(this.buildUrl(endpoint, params), {
      ...fetchOptions,
      headers: requestHeaders,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data as T;
  }

  async post<T = ApiResponse>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async get<T = ApiResponse>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  // Auth endpoints
  async register(email: string, password: string, name: string, hwid?: string): Promise<AuthResponse> {
    return this.post<AuthResponse>('', {
      action: 'reg',
      email,
      password,
      name,
      hwid,
    });
  }

  async login(email: string, password: string, hwid?: string, code?: string): Promise<AuthResponse> {
    return this.post<AuthResponse>('', {
      action: 'auth',
      email,
      password,
      hwid,
      code,
    });
  }

  async verifyEmail(code: string, email?: string): Promise<AuthResponse> {
    return this.post<AuthResponse>('', {
      action: 'verify_email',
      code,
      email,
    });
  }

  async resendVerificationCode(email: string, purpose: 'verify' | 'dev_login' = 'verify'): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'resend_verify',
      email,
      purpose,
    });
  }

  async forgotPassword(email: string): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'forgot_password',
      email,
    });
  }

  async resetPassword(email: string, code: string, password: string): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'reset_password',
      email,
      code,
      password,
    });
  }

  async changeEmail(code: string): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'change_email',
      code,
    });
  }

  async requestEmailChange(newEmail: string): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'request_email_change',
      email: newEmail,
    });
  }

  async logout(): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'logout',
    });
  }

  // User profile
  async getProfile(): Promise<ApiResponse<{ user: User }>> {
    return this.post<ApiResponse<{ user: User }>>('', {
      action: 'profile',
    });
  }

  async changeName(name: string): Promise<ApiResponse<{ user: User }>> {
    return this.post<ApiResponse<{ user: User }>>('', {
      action: 'name_change',
      name,
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'password_change',
      current_password: currentPassword,
      new_password: newPassword,
    });
  }

  // Subscriptions
  async getSubscriptions(): Promise<ApiResponse<{ subs: Subscription[] }>> {
    return this.post<ApiResponse<{ subs: Subscription[] }>>('', {
      action: 'subs_list',
    });
  }

  async buySubscription(subId: number): Promise<ApiResponse<{ sub_to?: string; order_id?: number; order_status?: 'pending' | 'paid'; amount?: number }>> {
    return this.post<ApiResponse<{ sub_to?: string; order_id?: number; order_status?: 'pending' | 'paid'; amount?: number }>>('', {
      action: 'sub_buy',
      sub_id: subId,
    });
  }

  // News
  async getNews(page = 1, perPage = 10): Promise<ApiResponse<PaginatedResponse<News>>> {
    return this.post<ApiResponse<PaginatedResponse<News>>>('', {
      action: 'news_list',
      page,
      per_page: perPage,
    });
  }

  async getNewsItem(id: number): Promise<ApiResponse<{ news: News; comments: NewsComment[] }>> {
    return this.post<ApiResponse<{ news: News; comments: NewsComment[] }>>('', {
      action: 'news_get',
      id,
    });
  }

  async addNewsComment(newsId: number, content: string): Promise<ApiResponse<{ comment: NewsComment }>> {
    return this.post<ApiResponse<{ comment: NewsComment }>>('', {
      action: 'news_comment_add',
      news_id: newsId,
      content,
    });
  }

  async editNewsComment(id: number, content: string): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'news_comment_edit',
      id,
      content,
    });
  }

  async deleteNewsComment(id: number): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'news_comment_delete',
      id,
    });
  }

  // Forum
  async getForumCategories(): Promise<ApiResponse<{ categories: ForumCategory[] }>> {
    return this.post<ApiResponse<{ categories: ForumCategory[] }>>('', {
      action: 'forum_categories',
    });
  }

  async getForumThreads(categoryId: number, page = 1, perPage = 20): Promise<ApiResponse<PaginatedResponse<ForumThread>>> {
    return this.post<ApiResponse<PaginatedResponse<ForumThread>>>('', {
      action: 'forum_threads',
      category_id: categoryId,
      page,
      per_page: perPage,
    });
  }

  async getForumThread(id: number): Promise<ApiResponse<{ thread: ForumThread; posts: ForumPost[] }>> {
    return this.post<ApiResponse<{ thread: ForumThread; posts: ForumPost[] }>>('', {
      action: 'forum_thread',
      id,
    });
  }

  async createForumThread(categoryId: number, title: string, content: string): Promise<ApiResponse<{ thread: ForumThread }>> {
    return this.post<ApiResponse<{ thread: ForumThread }>>('', {
      action: 'forum_thread_create',
      category_id: categoryId,
      title,
      content,
    });
  }

  async createForumPost(threadId: number, content: string): Promise<ApiResponse<{ post: ForumPost }>> {
    return this.post<ApiResponse<{ post: ForumPost }>>('', {
      action: 'forum_post_create',
      thread_id: threadId,
      content,
    });
  }

  async editForumPost(postId: number, content: string): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'forum_post_edit',
      id: postId,
      content,
    });
  }

  async deleteForumPost(postId: number): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'forum_post_delete',
      id: postId,
    });
  }

  async deleteForumThread(threadId: number): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'forum_thread_delete',
      id: threadId,
    });
  }

  // Tickets
  async getTickets(): Promise<ApiResponse<{ tickets: Ticket[] }>> {
    return this.post<ApiResponse<{ tickets: Ticket[] }>>('', {
      action: 'tickets_list',
    });
  }

  async getTicket(id: number): Promise<ApiResponse<{ ticket: Ticket; messages: TicketMessage[] }>> {
    return this.post<ApiResponse<{ ticket: Ticket; messages: TicketMessage[] }>>('', {
      action: 'ticket_get',
      id,
    });
  }

  async createTicket(subject: string, category: Ticket['category'], message: string): Promise<ApiResponse<{ ticket: Ticket }>> {
    return this.post<ApiResponse<{ ticket: Ticket }>>('', {
      action: 'ticket_create',
      subject,
      category,
      message,
    });
  }

  async replyTicket(ticketId: number, message: string): Promise<ApiResponse<{ message: TicketMessage }>> {
    return this.post<ApiResponse<{ message: TicketMessage }>>('', {
      action: 'ticket_reply',
      ticket_id: ticketId,
      message,
    });
  }

  // Downloads
  async getDownloads(): Promise<ApiResponse<{ downloads: Download[] }>> {
    return this.post<ApiResponse<{ downloads: Download[] }>>('', {
      action: 'downloads_list',
    });
  }

  async getDownloadToken(downloadId: number): Promise<ApiResponse<{ token: string; expires_at: string }>> {
    return this.post<ApiResponse<{ token: string; expires_at: string }>>('', {
      action: 'download_token',
      download_id: downloadId,
    });
  }

  /** Absolute URL of the protected download endpoint for a one-time token. */
  getDownloadUrl(token: string): string {
    return this.buildUrl('/download', { token });
  }

  // License keys / Redeem
  async redeemKey(keyCode: string): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'redeem_key',
      key_code: keyCode,
    });
  }

  // HWID Reset
  async resetHwid(): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'hwid_reset',
    });
  }

  // Settings
  async getSettings(): Promise<ApiResponse<{ settings: Settings }>> {
    return this.post<ApiResponse<{ settings: Settings }>>('', {
      action: 'settings_get',
    });
  }

  // Admin endpoints
  async adminGetUsers(page = 1, perPage = 50): Promise<ApiResponse<PaginatedResponse<User>>> {
    return this.post<ApiResponse<PaginatedResponse<User>>>('', {
      action: 'admin_users',
      page,
      per_page: perPage,
    });
  }

  async adminBanUser(targetId: number, reason: string): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'ban',
      target_id: targetId,
      reason,
    });
  }

  async adminUnbanUser(targetId: number): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'unban',
      target_id: targetId,
    });
  }

  async adminAddBalance(targetId: number, amount: number): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'balance_add',
      target_id: targetId,
      amount,
    });
  }

  /** Extends a subscription manually. Negative `days` revokes it. */
  async adminGrantSubscription(targetId: number, days: number, subId?: number): Promise<ApiResponse<{ sub_to: string; sub_id: number }>> {
    return this.post<ApiResponse<{ sub_to: string; sub_id: number }>>('', {
      action: 'admin_sub_grant',
      target_id: targetId,
      days,
      sub_id: subId,
    });
  }

  async adminResetUserHwid(targetId: number): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'admin_hwid_reset',
      target_id: targetId,
    });
  }

  async adminCreateSubscription(data: Partial<Subscription>): Promise<ApiResponse<{ sub: Subscription }>> {
    return this.post<ApiResponse<{ sub: Subscription }>>('', {
      action: 'admin_sub_create',
      ...data,
    });
  }

  async adminUpdateSubscription(id: number, data: Partial<Subscription>): Promise<ApiResponse<{ sub: Subscription }>> {
    return this.post<ApiResponse<{ sub: Subscription }>>('', {
      action: 'admin_sub_update',
      id,
      ...data,
    });
  }

  async adminDeleteSubscription(id: number): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'admin_sub_delete',
      id,
    });
  }

  async adminGetDownloads(): Promise<ApiResponse<{ downloads: AdminDownload[] }>> {
    return this.post<ApiResponse<{ downloads: AdminDownload[] }>>('', {
      action: 'admin_downloads',
    });
  }

  async adminCreateDownload(data: { title: string; version: string; filename: string; changelog?: string; is_active?: number }): Promise<ApiResponse<{ download: AdminDownload }>> {
    return this.post<ApiResponse<{ download: AdminDownload }>>('', {
      action: 'admin_download_create',
      ...data,
    });
  }

  async adminUpdateDownload(id: number, data: Partial<AdminDownload>): Promise<ApiResponse<{ download: AdminDownload }>> {
    return this.post<ApiResponse<{ download: AdminDownload }>>('', {
      action: 'admin_download_update',
      id,
      ...data,
    });
  }

  async adminDeleteDownload(id: number): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'admin_download_delete',
      id,
    });
  }

  async adminCreateLicenseKey(subId: number, daysOverride?: number, note?: string): Promise<ApiResponse<{ key: LicenseKey }>> {
    return this.post<ApiResponse<{ key: LicenseKey }>>('', {
      action: 'admin_key_create',
      sub_id: subId,
      days_override: daysOverride,
      note,
    });
  }

  async adminGetLicenseKeys(page = 1, perPage = 50): Promise<ApiResponse<PaginatedResponse<LicenseKey>>> {
    return this.post<ApiResponse<PaginatedResponse<LicenseKey>>>('', {
      action: 'admin_keys_list',
      page,
      per_page: perPage,
    });
  }

  async adminDeleteLicenseKey(id: number): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'admin_key_delete',
      id,
    });
  }

  async adminCreateNews(data: { title: string; short_desc: string; content: string; is_published?: number; is_pinned?: number }): Promise<ApiResponse<{ news: News }>> {
    return this.post<ApiResponse<{ news: News }>>('', {
      action: 'admin_news_create',
      ...data,
    });
  }

  async adminUpdateNews(id: number, data: Partial<News>): Promise<ApiResponse<{ news: News }>> {
    return this.post<ApiResponse<{ news: News }>>('', {
      action: 'admin_news_update',
      id,
      ...data,
    });
  }

  async adminDeleteNews(id: number): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'admin_news_delete',
      id,
    });
  }

  async adminGetOrders(page = 1, perPage = 50): Promise<ApiResponse<PaginatedResponse<Order>>> {
    return this.post<ApiResponse<PaginatedResponse<Order>>>('', {
      action: 'admin_orders',
      page,
      per_page: perPage,
    });
  }

  async adminSetOrderStatus(id: number, status: Order['status']): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'admin_order_status',
      id,
      status,
    });
  }

  async adminGetTickets(page = 1, perPage = 50): Promise<ApiResponse<PaginatedResponse<Ticket>>> {
    return this.post<ApiResponse<PaginatedResponse<Ticket>>>('', {
      action: 'admin_tickets',
      page,
      per_page: perPage,
    });
  }

  async adminReplyTicket(ticketId: number, message: string): Promise<ApiResponse<{ message: TicketMessage }>> {
    return this.post<ApiResponse<{ message: TicketMessage }>>('', {
      action: 'admin_ticket_reply',
      ticket_id: ticketId,
      message,
    });
  }

  async adminUpdateTicketStatus(ticketId: number, status: Ticket['status']): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'admin_ticket_status',
      ticket_id: ticketId,
      status,
    });
  }

  async adminGetLogs(page = 1, perPage = 50): Promise<ApiResponse<PaginatedResponse<{ id: number; admin_id: number; action: string; target_type: string | null; target_id: number | null; details: string | null; ip: string | null; created_at: string }>>> {
    return this.post<ApiResponse<PaginatedResponse<{ id: number; admin_id: number; action: string; target_type: string | null; target_id: number | null; details: string | null; ip: string | null; created_at: string }>>>('', {
      action: 'admin_logs',
      page,
      per_page: perPage,
    });
  }

  async adminGetStats(): Promise<ApiResponse<{ total_users: number; active_subs: number; total_balance: number; today_registrations: number }>> {
    return this.post<ApiResponse<{ total_users: number; active_subs: number; total_balance: number; today_registrations: number }>>('', {
      action: 'admin_stats',
    });
  }

  async adminUpdateSettings(data: Partial<Settings>): Promise<ApiResponse> {
    return this.post<ApiResponse>('', {
      action: 'admin_settings_update',
      ...data,
    });
  }
}

export const api = new ApiClient(API_BASE_URL);