import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface CallStats {
  incoming: number;
  outgoing: number;
  missed: number;
  rejected: number;
  incomingDuration: number;
  outgoingDuration: number;
  totalDuration: number;
  total: number;
  connected: number;
}

export interface EmployeeCallStat {
  phone: string;
  name?: string;
  incoming: number;
  outgoing: number;
  missed: number;
  rejected: number;
  totalDuration: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class CallLogService {
  constructor(private api: ApiService) {}

  private rangeParams(period: string, from?: string, to?: string): string {
    if (period === 'custom' && from) {
      return `from=${from}${to ? '&to=' + to : ''}`;
    }
    return `period=${period}`;
  }

  getSummary(companyCode: string, period: string, from?: string, to?: string): Observable<any> {
    const r = this.rangeParams(period, from, to);
    return this.api.get(`/api/calllogs/summary?companyCode=${encodeURIComponent(companyCode)}&${r}`);
  }

  getEmployeesStats(companyCode: string, period: string, from?: string, to?: string): Observable<any> {
    const r = this.rangeParams(period, from, to);
    return this.api.get(`/api/calllogs/employees?companyCode=${encodeURIComponent(companyCode)}&${r}`);
  }

  getEmployeeStat(companyCode: string, phone: string, period: string, from?: string, to?: string): Observable<any> {
    const r = this.rangeParams(period, from, to);
    return this.api.get(`/api/calllogs/employee?companyCode=${encodeURIComponent(companyCode)}&phone=${encodeURIComponent(phone)}&${r}`);
  }

  getCallDetails(companyCode: string, phone: string, period: string, from?: string, to?: string): Observable<any> {
    const r = this.rangeParams(period, from, to);
    return this.api.get(`/api/calllogs/details?companyCode=${encodeURIComponent(companyCode)}&phone=${encodeURIComponent(phone)}&${r}`);
  }

  getTimeline(companyCode: string, period: string, from?: string, to?: string): Observable<any> {
    const r = this.rangeParams(period, from, to);
    return this.api.get(`/api/calllogs/timeline?companyCode=${encodeURIComponent(companyCode)}&${r}`);
  }
}
