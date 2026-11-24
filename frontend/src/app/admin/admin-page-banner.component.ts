import { Component, Input } from '@angular/core';

@Component({
  selector: 'parking-admin-banner',
  standalone: true,
  template: `
    <header class="relative isolate overflow-hidden rounded-[1.75rem] bg-[#101d2c] px-6 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-9 sm:py-8">
      <span class="absolute -right-20 -top-32 -z-10 size-80 rounded-full border-[42px] border-white/[0.04]" aria-hidden="true"></span>
      <span class="absolute -bottom-24 right-28 -z-10 size-52 rounded-full bg-[#c5f277]/[0.08] blur-2xl" aria-hidden="true"></span>
      <div class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div class="max-w-2xl">
          <p class="mb-3 flex items-center gap-2 text-[0.67rem] font-bold tracking-[0.18em] text-[#c5f277]"><span class="size-2 rounded-full bg-[#c5f277]"></span> PARKING INTELLIGENT <span class="text-white/35">/</span> ADMINISTRATION</p>
          <h1 class="mb-2 mt-0 text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-white sm:text-5xl">{{ title }}</h1>
          <p class="m-0 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">{{ description }}</p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2"><ng-content select="[banner-action]"></ng-content><span class="rounded-full border border-white/15 bg-[#fcfdff]/[0.04] px-3 py-2 text-[0.65rem] font-bold tracking-[0.15em] text-slate-300">ADMIN / {{ code }}</span></div>
      </div>
    </header>
  `
})
export class AdminPageBannerComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) description!: string;
  @Input({ required: true }) code!: string;
}
