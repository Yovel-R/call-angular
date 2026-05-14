import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { OPERATIONAL_PAGE_SIZE } from '../../../core/config/pagination.config';
import { FastCacheService } from '../../../services/fast-cache.service';
import { QuotationRecord } from '../domain/quotation.model';
import { QuotationHistoryQuery, QuotationsRepository } from '../data/quotations.repository';

export interface QuotationsState {
  history: QuotationRecord[];
  search: string;
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  error: string;
}

@Injectable({ providedIn: 'root' })
export class QuotationsViewModel {
  private readonly stateSubject = new BehaviorSubject<QuotationsState>({
    history: [],
    search: '',
    page: 1,
    pageSize: OPERATIONAL_PAGE_SIZE,
    total: 0,
    loading: false,
    error: '',
  });

  readonly state$ = this.stateSubject.asObservable();

  constructor(private repository: QuotationsRepository, private fastCache: FastCacheService) {}

  load(query: QuotationHistoryQuery): void {
    const cacheKey = this.fastCache.key(['quotations-vm', query.companyCode, query.employeePhone, query.search, query.dateFrom, query.dateTo, query.page || 1]);
    const cached = this.fastCache.get<QuotationsState>(cacheKey);
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
      error: () => this.patch({ loading: false, error: 'Failed to load quotation history.' }),
    });
  }

  private patch(partial: Partial<QuotationsState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}
