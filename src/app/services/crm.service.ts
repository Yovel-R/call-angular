import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CrmLoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: 'crm_admin';
    companyName: string;
    companyCode?: string;
    teamSize?: string;
  };
}

export interface CrmClient {
  id: string;
  companyCode: string;
  companyName: string;
  leadCompanyName: string;
  primaryContact: string;
  primaryPhone: string;
  primaryEmail: string;
  description: string;
  status: string;
  contacts: any[];
  contactCount: number;
  managers: string[];
  remarks: string[];
  latestUpdate: string;
  slaStatus: string;
  ndaStatus: string;
  amcStatus: string;
}

@Injectable({ providedIn: 'root' })
export class CrmService {
  private readonly baseUrl = environment.crmApiBaseUrl;

  constructor(private http: HttpClient) {}

  login(payload: { email: string; password: string }): Observable<CrmLoginResponse> {
    return this.http.post<CrmLoginResponse>(`${this.baseUrl}/api/crm/auth/login`, payload, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
    });
  }

  getClients(params: { search?: string; companyCode?: string } = {}): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/crm/clients${this.query(params)}`, {
      headers: this.headers(),
    });
  }

  getContracts(type: 'SLA' | 'NDA', params: { companyCode?: string; clientCompanyName?: string } = {}): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/crm/contracts${this.query({ ...params, type })}`, {
      headers: this.headers(),
    });
  }

  generateContract(payload: {
    type: 'SLA' | 'NDA';
    companyCode?: string;
    clientCompanyName: string;
    contactName?: string;
    contactEmail?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/crm/contracts/generate`, payload, {
      headers: this.headers(),
    });
  }

  getAmc(params: { search?: string; companyCode?: string } = {}): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/crm/amc${this.query(params)}`, {
      headers: this.headers(),
    });
  }

  getPayments(params: { companyCode?: string; clientCompanyName?: string } = {}): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/crm/payments${this.query(params)}`, {
      headers: this.headers(),
    });
  }

  generatePaidInvoice(payload: {
    companyCode?: string;
    clientCompanyName: string;
    amount: number;
    paidAmount?: number;
    paymentMode?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/crm/payments/paid-invoice`, payload, {
      headers: this.headers(),
    });
  }

  getTickets(params: { companyCode?: string; clientCompanyName?: string } = {}): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/crm/tickets${this.query(params)}`, {
      headers: this.headers(),
    });
  }

  createTicket(payload: {
    companyCode?: string;
    clientCompanyName: string;
    subject: string;
    query?: string;
    priority?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/crm/tickets`, payload, {
      headers: this.headers(),
    });
  }

  private headers(): HttpHeaders {
    const token = localStorage.getItem('tracecall_crm_token') || '';
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  private query(params: Record<string, unknown>): string {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        search.set(key, String(value));
      }
    });
    const value = search.toString();
    return value ? `?${value}` : '';
  }
}
