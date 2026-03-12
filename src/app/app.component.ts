import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { NgIf, NgFor, SlicePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, ChartType, registerables } from 'chart.js';
import { AuthService, RegisterPayload, LoginPayload } from './services/auth.service';
import { EmployeeService, Employee } from './services/employee.service';
import { CallLogService, CallStats } from './services/calllog.service';

@Component({
  selector: 'app-root',
  imports: [NgIf, NgFor, FormsModule, SlicePipe, DecimalPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  encapsulation: ViewEncapsulation.None
})
export class AppComponent implements OnInit {
  title = 'web-page';

  // ── Signup / Login ─────────────────────────────────────────
  signupForm: RegisterPayload = {
    companyName: '', companyAddress: '', name: '', email: '', password: '',
    countryCode: '+91', mobile: '', teamSize: '', industry: '',
  };
  signupError = '';
  signupSuccess = false;
  signupLoading = false;
  isTrialRequest = false;

  openTrialSignup(): void {
    this.isTrialRequest = true;
    this.openSignup();
  }

  loginForm: LoginPayload = { email: '', password: '' };
  loginError = '';
  loginLoading = false;

  pwdChecks = { length: false, upper: false, number: false, symbol: false };

  readonly TEAM_SIZES = ['1-5', '6-10', '11-15', '16-25', '26-50', '50+'];
  readonly INDUSTRIES = [
    'IT / ITES', 'BPO / KPO', 'Banking & Finance', 'Healthcare',
    'Retail & E-commerce', 'Manufacturing', 'Telecom', 'Education',
    'Real Estate', 'Other',
  ];

  // ── Dashboard session ──────────────────────────────────────
  loggedIn = false;
  dashboardCompany = '';
  dashboardCode = '';

  // ── UI panels ──────────────────────────────────────────────
  isMobileMenuOpen = false;
  isLoginOpen = false;
  isSignupOpen = false;

  // ── Dashboard tabs ─────────────────────────────────────────
  dashTab: 'overview' | 'employees' | 'company' = 'overview';

  // ── Period selector ────────────────────────────────────────
  selectedPeriod: 'today' | 'yesterday' | 'lastweek' | 'custom' = 'today';
  customFrom = '';
  customTo = '';
  readonly periods = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'lastweek', label: 'Last Week' },
    { key: 'custom', label: 'Custom' },
  ];
  get todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ── Stats ──────────────────────────────────────────────────
  summaryStats: CallStats | null = null;
  summaryLoading = false;

  // ── Employee list ──────────────────────────────────────────
  employees: Employee[] = [];
  employeesLoading = false;
  employeesError = '';
  isAddEmployeeOpen = false;
  addEmployeeLoading = false;
  addEmployeeError = '';
  newEmployee = { name: '', mobile: '' };

  employeeCallRows: { emp: Employee; stats: any }[] = [];
  empCallLoading = false;
  empCallError = '';
  syncAllLoading = false;
  syncEmpLoading = false;
  sidebarOpen = false;

  // ── Employee drilldown ─────────────────────────────────────
  selectedEmployee: Employee | null = null;
  selectedEmpStats: CallStats | null = null;
  selectedEmpLoading = false;
  selectedEmpCalls: any[] = [];
  selectedEmpCallsLoading = false;
  drilldownTab: 'stats' | 'calls' = 'stats';

  // ── Chart state ────────────────────────────────────────────
  chartType: 'line' | 'pie' | 'bar' = 'pie';
  chart: Chart | null = null;

  overviewChartType: 'pie' | 'bar' = 'pie';
  overviewChart: Chart | null = null;
  timelineChart: Chart | null = null;
  donutChart: Chart | null = null;
  timelineData: any[] = [];

  // ── Company Profile ────────────────────────────────────────
  companyProfile: any = null;
  companyProfileLoading = false;

  changePwdForm = { oldPassword: '', newPassword: '', confirmPassword: '' };
  changePwdLoading = false;
  changePwdError = '';
  changePwdSuccess = '';
  changePwdChecks = { length: false, upper: false, number: false, symbol: false };

  editingAddress = false;
  editAddressValue = '';
  saveAddressLoading = false;
  saveAddressError = '';
  saveAddressSuccess = '';

  today = new Date();

  constructor(
    private authService: AuthService,
    private employeeService: EmployeeService,
    private callLogService: CallLogService,
  ) { }

  ngOnInit(): void {
    Chart.register(...registerables);
    const raw = localStorage.getItem('tracecall_user');
    if (raw) {
      try {
        const user = JSON.parse(raw);
        this.loggedIn = true;
        this.dashboardCompany = user.companyName || 'Your Company';
        this.dashboardCode = user.companyCode || '';
        this._loadDashboard();
      } catch { localStorage.removeItem('tracecall_user'); }
    }
  }

  // ── Helpers ───────────────────────────────────────────────
  fmtDur(seconds: number): string {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  // Returns avg call duration formatted as Xm Ys (based on connected calls)
  fmtAvgDur(totalDuration: number, connectedCalls: number): string {
    if (!connectedCalls || !totalDuration) return '0s';
    const avg = Math.round(totalDuration / connectedCalls);
    const m = Math.floor(avg / 60);
    const s = avg % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  fmtDate(d: string | undefined | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  fmtTime(ts: string | number | undefined): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  periodLabel(p: string): string {
    return this.periods.find(x => x.key === p)?.label ?? p;
  }

  // ── Dashboard loader ──────────────────────────────────────
  _loadDashboard(): void {
    this.fetchSummary();
    this.fetchEmployees();
    this.fetchCompanyProfile();
  }

  fetchSummary(): void {
    this.summaryLoading = true;
    this.summaryStats = null;

    if (this.timelineChart) { this.timelineChart.destroy(); this.timelineChart = null; }
    if (this.donutChart) { this.donutChart.destroy(); this.donutChart = null; }

    this.callLogService.getSummary(
      this.dashboardCode, this.selectedPeriod,
      this.selectedPeriod === 'custom' ? this.customFrom : undefined,
      this.selectedPeriod === 'custom' ? (this.customTo || undefined) : undefined,
    ).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.summaryStats = res.stats;
          this.fetchPreviousStats(res.from, res.to);
          
          // Increase timeout to ensure *ngIf has rendered the canvas
          setTimeout(() => {
            this.renderDonutChart();
            if (this.timelineData.length) this.renderTimelineChart();
          }, 500); // bump from 300 → 500
          
        } else {
          this.summaryLoading = false;
        }
      },
      error: () => { this.summaryLoading = false; }
    });

    this.callLogService.getTimeline(
      this.dashboardCode, this.selectedPeriod,
      this.selectedPeriod === 'custom' ? this.customFrom : undefined,
      this.selectedPeriod === 'custom' ? (this.customTo || undefined) : undefined,
    ).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.timelineData = res.timeline;
          setTimeout(() => this.renderTimelineChart(), 350);
        }
      },
      error: () => { }
    });
  }

  kpiMetrics = {
    connectRate: 0,
    durationProgress: 0,
    totalCallsProgress: 0,
    missedRate: 0,
    trends: { connected: 0, duration: 0, total: 0, missed: 0 }
  };

  fetchPreviousStats(currentFrom: string, currentTo: string): void {
    const fromDate = new Date(currentFrom);
    const toDate = new Date(currentTo || currentFrom);
    const diff = toDate.getTime() - fromDate.getTime();
    const prevTo = new Date(fromDate.getTime() - (24 * 60 * 60 * 1000));
    const prevFrom = new Date(prevTo.getTime() - diff);

    const fromStr = prevFrom.toISOString().split('T')[0];
    const toStr = prevTo.toISOString().split('T')[0];

    this.callLogService.getSummary(this.dashboardCode, 'custom', fromStr, toStr).subscribe({
      next: (res: any) => {
        this.summaryLoading = false;
        if (res.success && res.stats) {
          this.calculateMetrics(this.summaryStats!, res.stats);
        } else {
          this.calculateMetrics(this.summaryStats!, null);
        }
      },
      error: () => {
        this.summaryLoading = false;
        this.calculateMetrics(this.summaryStats!, null);
      }
    });
  }

  calculateMetrics(curr: CallStats, prev: CallStats | null): void {
    const total = curr.total || 0;
    const connected = curr.connected || 0;

    // Rates (0–1)
    this.kpiMetrics.connectRate = total ? (connected / total) : 0;
    this.kpiMetrics.missedRate = total ? (curr.missed / total) : 0;

    if (prev && prev.total) {
      // Progress relative to previous period (capped at 1.0 = 100%)
      this.kpiMetrics.durationProgress = Math.min(curr.totalDuration / Math.max(prev.totalDuration, 1), 1);
      this.kpiMetrics.totalCallsProgress = Math.min(total / Math.max(prev.total, 1), 1);
      // Trends vs previous period
      this.kpiMetrics.trends.connected = this.calcTrend(connected, prev.connected);
      this.kpiMetrics.trends.total = this.calcTrend(curr.total, prev.total);
      this.kpiMetrics.trends.duration = this.calcTrend(curr.totalDuration, prev.totalDuration);
      this.kpiMetrics.trends.missed = this.calcTrend(curr.missed, prev.missed);
    } else {
      // No previous data — use rates as progress indicators
      this.kpiMetrics.durationProgress = this.kpiMetrics.connectRate; // fallback: mirror connect rate
      this.kpiMetrics.totalCallsProgress = total > 0 ? 1 : 0;           // full if there are calls
      this.kpiMetrics.trends = { connected: 0, duration: 0, total: 0, missed: 0 };
    }
  }

  calcTrend(curr: number, prev: number): number {
    if (!prev) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  }

  onPeriodChange(p: string): void {
    this.selectedPeriod = p as any;
    if (this.timelineChart) { this.timelineChart.destroy(); this.timelineChart = null; }
    if (this.donutChart) { this.donutChart.destroy(); this.donutChart = null; }
    if (p !== 'custom') {
      this.fetchSummary();
      this.fetchEmployeeCallRows();
      if (this.selectedEmployee) this.openEmployee(this.selectedEmployee);
    }
  }

  applyCustomRange(): void {
    if (!this.customFrom) return;
    this.fetchSummary();
    this.fetchEmployeeCallRows();
    if (this.selectedEmployee) this.openEmployee(this.selectedEmployee);
  }

  fetchEmployees(): void {
    if (!this.dashboardCode) return;
    this.employeesLoading = true;
    this.employeesError = '';
    this.employeeService.getEmployees(this.dashboardCode).subscribe({
      next: (res: any) => {
        this.employeesLoading = false;
        if (res.success && res.employees) {
          this.employees = res.employees;
          this.fetchEmployeeCallRows();
        } else {
          this.employeesError = res.message || 'Failed to load employees.';
        }
      },
      error: (err: any) => {
        this.employeesLoading = false;
        this.employeesError = err?.error?.message || 'Server error: Could not connect to the server. Please try again.';
      }
    });
  }

  fetchEmployeeCallRows(): void {
    if (!this.dashboardCode) return;
    this.empCallLoading = true;
    this.empCallError = '';
    this.callLogService.getEmployeesStats(
      this.dashboardCode, this.selectedPeriod,
      this.selectedPeriod === 'custom' ? this.customFrom : undefined,
      this.selectedPeriod === 'custom' ? (this.customTo || undefined) : undefined,
    ).subscribe({
      next: (res: any) => {
        this.empCallLoading = false;
        if (res.success) {
          const statsMap: Record<string, any> = {};
          for (const s of res.employees) statsMap[s.phone] = s;
          this.employeeCallRows = this.employees.map(emp => ({
            emp,
            stats: statsMap[emp.mobile] ?? null,
          }));
        } else {
          this.empCallError = res.message || 'Failed to load call data.';
        }
      },
      error: (err: any) => {
        this.empCallLoading = false;
        this.empCallError = err?.error?.message || 'Server error: Could not load call statistics.';
      }
    });
  }

  syncAll(): void {
    this.syncAllLoading = true;
    this.fetchSummary();
    this.fetchEmployeeCallRows();
    this.fetchEmployees();
    setTimeout(() => this.syncAllLoading = false, 1500);
  }

  syncEmployee(): void {
    if (!this.selectedEmployee) return;
    this.syncEmpLoading = true;
    this.openEmployee(this.selectedEmployee);
    setTimeout(() => this.syncEmpLoading = false, 1500);
  }

  // ── Employee drilldown ────────────────────────────────────
  openEmployee(emp: Employee): void {
    this.selectedEmployee = emp;
    this.selectedEmpStats = null;
    this.selectedEmpCalls = [];
    this.selectedEmpLoading = true;
    this.selectedEmpCallsLoading = true;
    this.drilldownTab = 'stats';

    this.callLogService.getEmployeeStat(
      this.dashboardCode, emp.mobile, this.selectedPeriod,
      this.selectedPeriod === 'custom' ? this.customFrom : undefined,
      this.selectedPeriod === 'custom' ? (this.customTo || undefined) : undefined,
    ).subscribe({
      next: (res: any) => {
        this.selectedEmpLoading = false;
        if (res.success) this.selectedEmpStats = res.stats;
      },
      error: () => { this.selectedEmpLoading = false; }
    });

    this.callLogService.getCallDetails(
      this.dashboardCode, emp.mobile, this.selectedPeriod,
      this.selectedPeriod === 'custom' ? this.customFrom : undefined,
      this.selectedPeriod === 'custom' ? (this.customTo || undefined) : undefined,
    ).subscribe({
      next: (res: any) => {
        this.selectedEmpCallsLoading = false;
        if (res.success) {
          this.selectedEmpCalls = res.calls;
          setTimeout(() => this.renderChart(), 100);
        }
      },
      error: () => { this.selectedEmpCallsLoading = false; }
    });
  }

  selectEmployee(emp: Employee) { this.openEmployee(emp); }

  closeEmployee(): void {
    this.selectedEmployee = null;
    this.selectedEmpStats = null;
  }

  setChartType(type: 'line' | 'pie' | 'bar'): void {
    this.chartType = type;
    this.renderChart();
  }

  setOverviewChartType(type: 'pie' | 'bar'): void {
    this.overviewChartType = type;
    this.renderOverviewChart();
  }

  // ── Chart renderers ───────────────────────────────────────

  renderOverviewChart(): void {
    if (this.overviewChart) { this.overviewChart.destroy(); this.overviewChart = null; }
    const canvas = document.getElementById('overviewChart') as HTMLCanvasElement;
    if (!canvas || !this.summaryStats) return;

    const textColor = 'rgba(59,59,59,0.7)';
    const gridColor = 'rgba(0,0,0,0.05)';
    const s = this.summaryStats;
    const counts = {
      incoming: s.incoming || 0, outgoing: s.outgoing || 0,
      missed: s.missed || 0, rejected: s.rejected || 0
    };

    const data = {
      labels: ['Incoming', 'Outgoing', 'Missed', 'Rejected'],
      datasets: [{
        label: 'Call Count',
        data: [counts.incoming, counts.outgoing, counts.missed, counts.rejected],
        backgroundColor: ['#22c55e', '#f97316', '#ef4444', '#ec4899'],
        borderWidth: this.overviewChartType === 'pie' ? 2 : 0,
        borderColor: '#ffffff',
        borderRadius: this.overviewChartType === 'bar' ? 6 : 0,
        barPercentage: 0.6
      }]
    };
    const options: any = {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          display: this.overviewChartType === 'pie', position: 'right',
          labels: { color: textColor, font: { size: 12 }, padding: 15 }
        },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, cornerRadius: 8 }
      },
      scales: this.overviewChartType === 'bar' ? {
        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1, padding: 8 } },
        x: { grid: { display: false }, ticks: { color: textColor, padding: 8 } }
      } : undefined
    };
    this.overviewChart = new Chart(canvas, { type: this.overviewChartType, data, options });
  }

  renderTimelineChart(): void {
    if (this.timelineChart) { this.timelineChart.destroy(); this.timelineChart = null; }
    const canvas = document.getElementById('timelineChart') as HTMLCanvasElement;
    if (!canvas) return;

    const labels = this.timelineData.map(d =>
      new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })
    );
    const totalCalls = this.timelineData.map(d =>
      (d.incoming || 0) + (d.outgoing || 0) + (d.missed || 0) + (d.rejected || 0)
    );

    const textColor = 'rgba(80,80,100,0.6)';
    const gridColor = 'rgba(0,0,0,0.04)';
    const ctx = canvas.getContext('2d');
    const grad = ctx ? ctx.createLinearGradient(0, 0, 0, 260) : null;
    if (grad) {
      grad.addColorStop(0, 'rgba(239,68,68,0.15)');
      grad.addColorStop(1, 'rgba(239,68,68,0)');
    }

    this.timelineChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['No data'],
        datasets: [{
          label: 'Total Calls',
          data: totalCalls.length ? totalCalls : [0],
          borderColor: '#ef4444',
          backgroundColor: grad ?? 'rgba(239,68,68,0.1)',
          fill: true,
          tension: 0.5,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointBackgroundColor: '#ef4444',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(255,255,255,0.95)',
            titleColor: '#111', bodyColor: '#444',
            borderColor: '#e5e7eb', borderWidth: 1,
            padding: 10, cornerRadius: 8
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { size: 11 }, maxRotation: 0, padding: 8 }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: textColor, font: { size: 11 }, padding: 8,
              callback: (value: any) => value >= 1000 ? (value / 1000) + 'k' : value
            },
            grid: { color: gridColor },
            border: { display: false }
          }
        }
      }
    });
  }

  renderDonutChart(): void {
    if (this.donutChart) { 
      this.donutChart.destroy(); 
      this.donutChart = null; 
    }
    
    const canvas = document.getElementById('donutChart') as HTMLCanvasElement;
    
    // Guard: canvas not in DOM yet
    if (!canvas) {
      setTimeout(() => this.renderDonutChart(), 200);
      return;
    }
    
    if (!this.summaryStats) return;

    const s = this.summaryStats;
    this.donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Incoming', 'Outgoing', 'Missed', 'Rejected'],
        datasets: [{
          data: [s.incoming || 0, s.outgoing || 0, s.missed || 0, s.rejected || 0],
          backgroundColor: ['#3b82f6', '#22c55e', '#f87171', '#f59e0b'],
          borderWidth: 3,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(255,255,255,0.95)',
            titleColor: '#111', bodyColor: '#444',
            borderColor: '#e5e7eb', borderWidth: 1,
            padding: 10, cornerRadius: 8
          }
        }
      }
    });
  }

  renderChart(): void {
    if (this.chart) { this.chart.destroy(); this.chart = null; }
    const canvas = document.getElementById('empChart') as HTMLCanvasElement;
    if (!canvas || !this.selectedEmpCalls.length) return;

    const textColor = 'rgba(59,59,59,0.7)';
    const gridColor = 'rgba(255,255,255,0.05)';
    let data: any, options: any;

    if (this.chartType === 'pie' || this.chartType === 'bar') {
      const counts = { incoming: 0, outgoing: 0, missed: 0, rejected: 0 };
      this.selectedEmpCalls.forEach(c => {
        if (c.callType in counts) (counts as any)[c.callType]++;
      });
      data = {
        labels: ['Incoming', 'Outgoing', 'Missed', 'Rejected'],
        datasets: [{
          label: 'Call Count',
          data: [counts.incoming, counts.outgoing, counts.missed, counts.rejected],
          backgroundColor: ['#22c55e', '#f97316', '#ef4444', '#ec4899'],
          borderWidth: this.chartType === 'pie' ? 2 : 0,
          borderColor: '#ffffff',
          borderRadius: this.chartType === 'bar' ? 6 : 0,
          barPercentage: 0.6
        }]
      };
      options = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            display: this.chartType === 'pie', position: 'right',
            labels: { color: textColor, font: { size: 12 }, padding: 15 }
          },
          tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, cornerRadius: 8 }
        },
        scales: this.chartType === 'bar' ? {
          y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1, padding: 8 } },
          x: { grid: { display: false }, ticks: { color: textColor, padding: 8 } }
        } : undefined
      };
    } else {
      // Line chart
      const map = new Map<string, number>();
      const calls = [...this.selectedEmpCalls].reverse();
      calls.forEach(c => {
        const d = new Date(c.timestamp);
        const k = this.selectedPeriod === 'today'
          ? (d.getHours() % 12 || 12) + (d.getHours() >= 12 ? ' PM' : ' AM')
          : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        map.set(k, (map.get(k) || 0) + 1);
      });

      const ctx = canvas.getContext('2d');
      let gradient: any = 'rgba(99,102,241,0.2)';
      if (ctx) {
        gradient = ctx.createLinearGradient(0, 0, 0, 220);
        gradient.addColorStop(0, 'rgba(99,102,241,0.4)');
        gradient.addColorStop(1, 'rgba(99,102,241,0.0)');
      }

      data = {
        labels: Array.from(map.keys()),
        datasets: [{
          label: 'Calls Made/Received',
          data: Array.from(map.values()),
          borderColor: '#6366f1',
          backgroundColor: gradient,
          fill: true, tension: 0.4,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#fff', pointBorderWidth: 2,
          pointRadius: 4, pointHoverRadius: 6, borderWidth: 3
        }]
      };
      options = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, cornerRadius: 8, displayColors: false }
        },
        interaction: { intersect: false, mode: 'index' },
        scales: {
          y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1, padding: 8 } },
          x: { grid: { display: false }, ticks: { color: textColor, maxRotation: 45, padding: 8 } }
        }
      };
    }

    this.chart = new Chart(canvas, { type: this.chartType, data, options });
  }

  // ── Auth flows ────────────────────────────────────────────
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }
  openLogin(): void { this.isLoginOpen = true; this.isSignupOpen = false; }
  openSignup(): void { this.isSignupOpen = true; this.isLoginOpen = false; }
  closeModals(): void { this.isLoginOpen = false; this.isSignupOpen = false; }

  onPasswordInput(value: string): void {
    this.signupForm.password = value;
    this.pwdChecks = {
      length: value.length >= 8,
      upper: /[A-Z]/.test(value),
      number: /[0-9]/.test(value),
      symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value),
    };
  }

  get passwordStrong(): boolean { return Object.values(this.pwdChecks).every(Boolean); }

  onSignupSubmit(event: Event): void {
    event.preventDefault();
    this.signupError = '';
    if (!this.passwordStrong) { this.signupError = 'Password does not meet strength requirements.'; return; }
    this.signupLoading = true;
    this.authService.register({ ...this.signupForm, isTrial: this.isTrialRequest }).subscribe({
      next: (res) => {
        this.signupLoading = false;
        if (res.success) this.signupSuccess = true;
        else this.signupError = res.message;
      },
      error: (err) => {
        this.signupLoading = false;
        this.signupError = err?.error?.message || 'Something went wrong.';
      },
    });
  }

  onLoginSubmit(event: Event): void {
    event.preventDefault();
    this.loginError = '';
    this.loginLoading = true;
    this.authService.login(this.loginForm).subscribe({
      next: (res) => {
        this.loginLoading = false;
        if (res.success && res.user) {
          this.closeModals();
          this.loggedIn = true;
          this.dashboardCompany = res.user.companyName || 'Your Company';
          this.dashboardCode = res.user.companyCode || 'N/A';
          localStorage.setItem('tracecall_user', JSON.stringify(res.user));
          setTimeout(() => window.scrollTo(0, 0), 0);
          this._loadDashboard();
        } else {
          this.loginError = res.message;
        }
      },
      error: (err) => {
        this.loginLoading = false;
        // Handle pending approval status
        if (err.status === 403) {
          this.loginError = err.error?.message || 'Account pending approval.';
        } else {
          this.loginError = err?.error?.message || 'Invalid credentials or server error.';
        }
      },
    });
  }

  goToLoginFromSuccess(): void { this.openLogin(); this.signupSuccess = false; }

  logout(): void {
    this.loggedIn = false;
    this.dashboardCompany = '';
    this.dashboardCode = '';
    this.employees = [];
    this.summaryStats = null;
    this.selectedEmployee = null;
    if (this.timelineChart) { this.timelineChart.destroy(); this.timelineChart = null; }
    if (this.donutChart) { this.donutChart.destroy(); this.donutChart = null; }
    localStorage.removeItem('tracecall_user');
    window.scrollTo(0, 0);
  }

  openAddEmployee(): void { this.isAddEmployeeOpen = true; this.addEmployeeError = ''; this.newEmployee = { name: '', mobile: '' }; }
  closeAddEmployee(): void { this.isAddEmployeeOpen = false; }

  onAddEmployeeSubmit(event: Event): void {
    event.preventDefault();
    this.addEmployeeError = '';
    if (!this.newEmployee.name || !this.newEmployee.mobile) {
      this.addEmployeeError = 'Name and mobile are required.'; return;
    }
    this.addEmployeeLoading = true;
    this.employeeService.addEmployee({ ...this.newEmployee, companyCode: this.dashboardCode }).subscribe({
      next: (res: any) => {
        this.addEmployeeLoading = false;
        if (res.success && res.employee) {
          this.employees.unshift(res.employee);
          this.closeAddEmployee();
          this.fetchEmployeeCallRows();
        } else this.addEmployeeError = res.message || 'Failed to add employee.';
      },
      error: (err: any) => {
        this.addEmployeeLoading = false;
        this.addEmployeeError = err?.error?.message || 'Server error.';
      }
    });
  }

  // ── Company & Password ────────────────────────────────────
  fetchCompanyProfile(): void {
    if (!this.dashboardCode) return;
    this.companyProfileLoading = true;
    this.authService.getCompanyProfile(this.dashboardCode).subscribe({
      next: (res: any) => {
        this.companyProfileLoading = false;
        if (res.success) {
          this.companyProfile = res.company;
          this.editAddressValue = res.company.companyAddress || '';
        }
      },
      error: () => { this.companyProfileLoading = false; }
    });
  }

  startEditAddress(): void {
    this.editingAddress = true;
    this.editAddressValue = this.companyProfile?.companyAddress || '';
    this.saveAddressError = '';
    this.saveAddressSuccess = '';
  }

  cancelEditAddress(): void {
    this.editingAddress = false;
    this.saveAddressError = '';
  }

  saveAddress(): void {
    this.saveAddressLoading = true;
    this.saveAddressError = '';
    this.saveAddressSuccess = '';
    this.authService.updateAddress(this.dashboardCode, this.editAddressValue).subscribe({
      next: (res: any) => {
        this.saveAddressLoading = false;
        if (res.success) {
          this.companyProfile.companyAddress = res.companyAddress;
          const raw = localStorage.getItem('tracecall_user');
          if (raw) {
            try {
              const user = JSON.parse(raw);
              user.companyAddress = res.companyAddress;
              localStorage.setItem('tracecall_user', JSON.stringify(user));
            } catch { }
          }
          this.editingAddress = false;
          this.saveAddressSuccess = 'Address updated!';
          setTimeout(() => this.saveAddressSuccess = '', 3000);
        } else { this.saveAddressError = res.message; }
      },
      error: (err: any) => {
        this.saveAddressLoading = false;
        this.saveAddressError = err?.error?.message || 'Server error.';
      }
    });
  }

  onChangePwdInput(value: string): void {
    this.changePwdForm.newPassword = value;
    this.changePwdChecks = {
      length: value.length >= 8,
      upper: /[A-Z]/.test(value),
      number: /[0-9]/.test(value),
      symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value),
    };
  }

  get changePwdStrong(): boolean { return Object.values(this.changePwdChecks).every(Boolean); }

  onChangePasswordSubmit(event: Event): void {
    event.preventDefault();
    this.changePwdError = '';
    this.changePwdSuccess = '';
    if (this.changePwdForm.newPassword !== this.changePwdForm.confirmPassword) {
      this.changePwdError = 'New passwords do not match.'; return;
    }
    if (!this.changePwdStrong) {
      this.changePwdError = 'New password does not meet strength requirements.'; return;
    }
    this.changePwdLoading = true;
    const p = { oldPassword: this.changePwdForm.oldPassword, newPassword: this.changePwdForm.newPassword };
    this.authService.changePassword(this.dashboardCode, p).subscribe({
      next: (res: any) => {
        this.changePwdLoading = false;
        if (res.success) {
          this.changePwdSuccess = 'Password updated successfully!';
          this.changePwdForm = { oldPassword: '', newPassword: '', confirmPassword: '' };
          this.changePwdChecks = { length: false, upper: false, number: false, symbol: false };
        } else { this.changePwdError = res.message; }
      },
      error: (err: any) => {
        this.changePwdLoading = false;
        this.changePwdError = err?.error?.message || 'Server error.';
      }
    });
  }
}