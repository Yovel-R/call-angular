import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { OPERATIONAL_PAGE_SIZE } from '../../../core/config/pagination.config';
import { FastCacheService } from '../../../services/fast-cache.service';
import { InvoiceRecord } from '../domain/invoice.model';
import { InvoiceHistoryQuery, InvoicesRepository } from '../data/invoices.repository';

export interface InvoicesState {
  history: InvoiceRecord[];
  search: string;
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  error: string;
}

@Injectable({ providedIn: 'root' })
export class InvoicesViewModel {
  private readonly stateSubject = new BehaviorSubject<InvoicesState>({
    history: [],
    search: '',
    page: 1,
    pageSize: OPERATIONAL_PAGE_SIZE,
    total: 0,
    loading: false,
    error: '',
  });

  readonly state$ = this.stateSubject.asObservable();

  constructor(private repository: InvoicesRepository, private fastCache: FastCacheService) {}

  load(query: InvoiceHistoryQuery): void {
    const cacheKey = this.fastCache.key(['invoices-vm', query.companyCode, query.employeePhone, query.search, query.dateFrom, query.dateTo, query.page || 1]);
    const cached = this.fastCache.get<InvoicesState>(cacheKey);
    if (cached) this.patch({ ...cached, loading: false, error: '' });
    this.patch({ loading: !cached, error: '', page: query.page || 1 });
    this.repository.history(query).subscribe({
      next: (page) => {
        const state = {
          history: page.items,
          page: page.page,
          pageSize: page.pageSize,
          total: page.total,
          loading: false,
          error: '',
        };
        this.fastCache.set(cacheKey, { ...this.stateSubject.value, ...state });
        this.patch(state);
      },
      error: () => this.patch({ loading: false, error: 'Failed to load invoice history.' }),
    });
  }

  private patch(partial: Partial<InvoicesState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}
