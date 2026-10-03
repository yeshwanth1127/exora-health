import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addDays,
  isBefore,
  startOfDay,
} from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

export interface DateTimeFilter {
  mode: 'flexible' | 'specific';
  date?: Date;
  flexibleTiming: 'anytime' | 'today' | 'next-3-days' | 'this-week' | 'this-weekend';
  selectedMonth?: string; // e.g. "Sep 2026"
  timeOfDay: 'anytime' | 'morning' | 'afternoon' | 'evening';
  displayString: string;
}

interface DateTimeBookingPickerProps {
  value: DateTimeFilter;
  onChange: (value: DateTimeFilter) => void;
}

const FLEXIBLE_TIMING_OPTIONS = [
  { id: 'anytime', label: 'Anytime' },
  { id: 'today', label: 'Today' },
  { id: 'next-3-days', label: 'Next 3 days' },
  { id: 'this-week', label: 'This week' },
  { id: 'this-weekend', label: 'This weekend' },
] as const;

const TIME_OF_DAY_OPTIONS = [
  { id: 'anytime', label: 'Anytime', icon: '✨' },
  { id: 'morning', label: 'Morning (9 AM - 12 PM)', icon: '☀️' },
  { id: 'afternoon', label: 'Afternoon (12 PM - 5 PM)', icon: '⛅' },
  { id: 'evening', label: 'Evening (5 PM - 8 PM)', icon: '🌙' },
] as const;

export const DateTimeBookingPicker: React.FC<DateTimeBookingPickerProps> = ({
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'flexible'>(
    value.mode === 'specific' ? 'calendar' : 'flexible'
  );

  // Calendar state
  const [currentBaseMonth, setCurrentBaseMonth] = useState<Date>(
    value.date || new Date()
  );
  const [tempDate, setTempDate] = useState<Date | undefined>(value.date);
  const [tempTimeOfDay, setTempTimeOfDay] = useState(value.timeOfDay);
  const [tempFlexibleTiming, setTempFlexibleTiming] = useState(value.flexibleTiming);
  const [tempSelectedMonth, setTempSelectedMonth] = useState<string | undefined>(
    value.selectedMonth
  );

  const today = startOfDay(new Date());

  // Generate 6 upcoming months for the Flexible tab cards
  const upcomingMonths = React.useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const m = addMonths(now, i);
      months.push({
        name: format(m, 'MMM'),
        full: format(m, 'MMM yyyy'),
        year: format(m, 'yyyy'),
        dateObj: m,
      });
    }
    return months;
  }, []);

  // Compute display string
  const formatSelection = (
    tab: 'calendar' | 'flexible',
    date?: Date,
    flexibleTiming?: string,
    selectedMonth?: string,
    timeOfDay?: string
  ): string => {
    const timeSuffix =
      timeOfDay && timeOfDay !== 'anytime'
        ? ` • ${timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1)}`
        : '';

    if (tab === 'calendar' && date) {
      return `${format(date, 'EEE, MMM d')}${timeSuffix}`;
    }

    if (tab === 'flexible') {
      if (flexibleTiming === 'today') return `Today${timeSuffix}`;
      if (flexibleTiming === 'next-3-days') return `Next 3 days${timeSuffix}`;
      if (flexibleTiming === 'this-week') return `This week${timeSuffix}`;
      if (flexibleTiming === 'this-weekend') return `This weekend${timeSuffix}`;
      if (selectedMonth) return `${selectedMonth}${timeSuffix}`;
      if (timeSuffix) return `Anytime${timeSuffix}`;
      return 'Anytime';
    }

    return 'Anytime';
  };

  const handleApply = () => {
    const display = formatSelection(
      activeTab,
      tempDate,
      tempFlexibleTiming,
      tempSelectedMonth,
      tempTimeOfDay
    );

    onChange({
      mode: activeTab === 'calendar' ? 'specific' : 'flexible',
      date: activeTab === 'calendar' ? tempDate : undefined,
      flexibleTiming: tempFlexibleTiming,
      selectedMonth: tempSelectedMonth,
      timeOfDay: tempTimeOfDay,
      displayString: display,
    });
    setIsOpen(false);
  };

  const handleResetToAnytime = () => {
    setTempDate(undefined);
    setTempFlexibleTiming('anytime');
    setTempSelectedMonth(undefined);
    setTempTimeOfDay('anytime');
    setActiveTab('flexible');
    onChange({
      mode: 'flexible',
      date: undefined,
      flexibleTiming: 'anytime',
      selectedMonth: undefined,
      timeOfDay: 'anytime',
      displayString: 'Anytime',
    });
    setIsOpen(false);
  };

  // Calendar helper to build a grid of days for a given month
  const renderMonthCalendar = (monthDate: Date, showPrev = false, showNext = false) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows: Date[][] = [];
    let days: Date[] = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        days.push(day);
        day = addDays(day, 1);
      }
      rows.push(days);
      days = [];
    }

    return (
      <div className="flex-1 min-w-[280px]">
        {/* Month Header */}
        <div className="flex items-center justify-between px-2 mb-4 h-9">
          {showPrev ? (
            <button
              type="button"
              onClick={() => setCurrentBaseMonth((prev) => subMonths(prev, 1))}
              disabled={isBefore(startOfMonth(subMonths(monthDate, 1)), startOfMonth(today))}
              className="p-1.5 rounded-full hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer text-neutral-700"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
          ) : (
            <div className="w-7" />
          )}

          <h3 className="font-bold text-neutral-900 text-sm sm:text-base tracking-tight">
            {format(monthDate, 'MMMM yyyy')}
          </h3>

          {showNext ? (
            <button
              type="button"
              onClick={() => setCurrentBaseMonth((prev) => addMonths(prev, 1))}
              className="p-1.5 rounded-full hover:bg-neutral-100 transition cursor-pointer text-neutral-700"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          ) : (
            <div className="w-7" />
          )}
        </div>

        {/* Weekday Names */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <span key={d} className="text-[11px] font-semibold text-neutral-400 py-1">
              {d}
            </span>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {rows.flat().map((dateItem, idx) => {
            const isCurrentMonth = isSameMonth(dateItem, monthDate);
            const isPast = isBefore(dateItem, today);
            const isTodayDate = isSameDay(dateItem, today);
            const isSelected = tempDate && isSameDay(dateItem, tempDate);

            if (!isCurrentMonth) {
              return <div key={idx} className="size-8 sm:size-9" />;
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={isPast}
                onClick={() => setTempDate(dateItem)}
                className={`size-8 sm:size-9 rounded-full text-xs sm:text-sm font-medium flex items-center justify-center transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-[#154734] text-white font-bold shadow-md scale-105'
                    : isPast
                    ? 'text-neutral-300 cursor-not-allowed'
                    : isTodayDate
                    ? 'text-[#154734] font-bold ring-1 ring-[#154734]/30 hover:bg-[#154734]/10'
                    : 'text-neutral-800 hover:bg-neutral-100'
                }`}
              >
                {format(dateItem, 'd')}
                {isTodayDate && !isSelected && (
                  <span className="absolute bottom-1 size-1 rounded-full bg-[#154734]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full text-left bg-transparent focus:outline-none cursor-pointer group flex items-center justify-between gap-1"
        >
          <div className="truncate">
            <span className="block text-sm sm:text-[15px] font-semibold text-neutral-900 truncate">
              {value.displayString || 'Anytime'}
            </span>
            <span className="block text-[11px] text-neutral-400 font-normal">
              {value.mode === 'specific' && value.date
                ? 'Selected date'
                : value.flexibleTiming !== 'anytime'
                ? 'Flexible preference'
                : 'Choose date or flexible'}
            </span>
          </div>
          <CalendarIcon className="size-4 text-neutral-400 group-hover:text-[#154734] transition shrink-0 ml-1" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="center"
        sideOffset={12}
        className="w-[calc(100vw-32px)] sm:w-[680px] max-w-[680px] p-0 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-neutral-200/90 overflow-hidden"
      >
        {/* Top Travel-Style Tabs: Calendar vs I'm Flexible */}
        <div className="flex border-b border-neutral-200 px-6 pt-3 bg-neutral-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`pb-3 px-4 text-sm sm:text-base font-semibold transition-all relative cursor-pointer ${
              activeTab === 'calendar'
                ? 'text-[#154734] font-bold'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Calendar
            {activeTab === 'calendar' && (
              <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#154734] rounded-t-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('flexible')}
            className={`pb-3 px-4 text-sm sm:text-base font-semibold transition-all relative cursor-pointer ${
              activeTab === 'flexible'
                ? 'text-[#154734] font-bold'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            I&apos;m flexible
            {activeTab === 'flexible' && (
              <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#154734] rounded-t-full" />
            )}
          </button>
        </div>

        {/* Tab 1: Calendar View (Two-month side-by-side like Airbnb/travel booking) */}
        {activeTab === 'calendar' && (
          <div className="p-5 sm:p-7 space-y-6">
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 justify-between">
              {renderMonthCalendar(currentBaseMonth, true, false)}
              <div className="hidden sm:block w-px bg-neutral-200/80 my-2" />
              {renderMonthCalendar(addMonths(currentBaseMonth, 1), false, true)}
            </div>

            {/* Preferred Time of Day */}
            <div className="pt-3 border-t border-neutral-100">
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2.5">
                Preferred Time of Day
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TIME_OF_DAY_OPTIONS.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setTempTimeOfDay(slot.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      tempTimeOfDay === slot.id
                        ? 'border-[#154734] bg-[#154734]/5 text-[#154734] ring-1 ring-[#154734]'
                        : 'border-neutral-200 hover:border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <span>{slot.icon}</span>
                    <span className="truncate">{slot.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: I'm flexible (Travel booking adaptation with radio options & month cards) */}
        {activeTab === 'flexible' && (
          <div className="p-5 sm:p-7 space-y-7">
            {/* Section 1: When do you need care? (Radio button options matching reference) */}
            <div>
              <h4 className="font-bold text-neutral-900 text-base sm:text-lg mb-3">
                When do you need care?
              </h4>
              <div className="flex flex-wrap gap-4 sm:gap-6">
                {FLEXIBLE_TIMING_OPTIONS.map((opt) => {
                  const isChecked = tempFlexibleTiming === opt.id && !tempSelectedMonth;
                  return (
                    <label
                      key={opt.id}
                      className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-neutral-800 hover:text-[#154734] transition select-none"
                    >
                      <input
                        type="radio"
                        name="flexible-timing"
                        checked={isChecked}
                        onChange={() => {
                          setTempFlexibleTiming(opt.id);
                          setTempSelectedMonth(undefined);
                        }}
                        className="size-4.5 text-[#154734] accent-[#154734] cursor-pointer"
                      />
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Section 2: When do you want to visit? (Month cards matching reference image 1) */}
            <div>
              <div className="mb-3">
                <h4 className="font-bold text-neutral-900 text-base sm:text-lg">
                  When do you want to visit?
                </h4>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Select preferred month for appointments
                </p>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {upcomingMonths.map((m) => {
                  const isSelected = tempSelectedMonth === m.full;
                  return (
                    <button
                      key={m.full}
                      type="button"
                      onClick={() => {
                        setTempSelectedMonth(isSelected ? undefined : m.full);
                        setTempFlexibleTiming('anytime');
                      }}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                        isSelected
                          ? 'border-[#154734] bg-[#154734]/5 text-[#154734] shadow-xs ring-2 ring-[#154734]/30'
                          : 'border-neutral-200/90 hover:border-neutral-400 text-neutral-800 bg-white hover:bg-neutral-50'
                      }`}
                    >
                      <CalendarIcon className={`size-4.5 ${isSelected ? 'text-[#154734]' : 'text-neutral-400'}`} />
                      <div className="text-sm font-bold tracking-tight">{m.name}</div>
                      <div className="text-[11px] text-neutral-500 font-medium">{m.year}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Time of Day preference */}
            <div className="pt-2 border-t border-neutral-100">
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2.5">
                Time of Day Preference
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TIME_OF_DAY_OPTIONS.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setTempTimeOfDay(slot.id)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      tempTimeOfDay === slot.id
                        ? 'border-[#154734] bg-[#154734]/5 text-[#154734] ring-1 ring-[#154734]'
                        : 'border-neutral-200 hover:border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <span>{slot.icon}</span>
                    <span className="truncate">{slot.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Popover Bottom Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-neutral-50 border-t border-neutral-200">
          <button
            type="button"
            onClick={handleResetToAnytime}
            className="text-xs sm:text-sm font-semibold text-neutral-600 hover:text-neutral-900 underline underline-offset-4 cursor-pointer"
          >
            Reset to Anytime
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="bg-[#154734] hover:bg-[#1e6b4c] text-white px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer active:scale-95"
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
