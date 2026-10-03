export interface Schedule {
  title: string;
  examDate: string;
  appOpeningDate?: string;
  appClosingDate?: string;
  status: string;
}

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export interface MetricUnit {
  value: number;
  label: string;
}

export interface DisplayMetrics {
  unit1: MetricUnit;
  unit2: MetricUnit;
  unit3: MetricUnit;
}

export interface OverlayProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

