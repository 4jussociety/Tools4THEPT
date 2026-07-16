export interface ManualTherapyRecord {
  therapist_name?: string;
  diagnosis?: string;
  techniques?: {
    selected: string[];
    details: string;
  };
  treatment_regions?: string[];
  cumulative_count?: number | null;
  evaluation?: {
    pre_treatment?: {
      pain_scale: number | null;
      rom_and_function: string;
      symptoms: string;
    };
    post_treatment?: {
      pain_scale: number | null;
      rom_and_function_changes: string;
      client_reaction: string;
    };
  };
  overall_effect?: {
    rating: string | null;
    details: string;
  };
}

export interface ChartData {
  clinical_record?: {
    subjective?: Record<string, any>;
    objective?: Record<string, any>;
    assessment?: {
      therapist_diagnosis?: string;
      ai_diagnosis_inferred?: string;
      [key: string]: any;
    };
    plan?: Record<string, any>;
  };
  manual_therapy_record?: ManualTherapyRecord;
  rapport_data?: Record<string, any>;
  [key: string]: any;
}

export interface SessionResult {
  id?: string;
  session_id: string;
  appointment_id?: string | null;
  client_id?: string;
  client_name?: string;
  chart_number?: string;
  execution_date?: string;
  raw_transcript?: string;
  refined_transcript?: string;
  guide_content?: string;
  chart_data?: ChartData;
}
