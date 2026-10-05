import { createClient } from '@supabase/supabase-js';
import type { PublishedExam, ExamSubmission } from '../types/quiz';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vsbpywcwwvstwpurdnpc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzYnB5d2N3d3ZzdHdwdXJkbnBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5ODEwNDcsImV4cCI6MjEwNTU1NzA0N30.VgdgE_ZbpXkjNksXOnGmDNqwzceIUPzBfLjtaAMRy2w';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const STORAGE_BUCKET = 'exam-files';

// ─────────────────────────────────────────────
// Storage helpers
// ─────────────────────────────────────────────

/**
 * Upload an exam source file (PDF or image) to Supabase Storage.
 * Returns the public URL of the uploaded file, or null on failure.
 */
export async function uploadExamFileToStorage(
  file: File,
  examId: string
): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `exams/${examId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) {
      console.error('Storage upload failed:', error.message);
      return null;
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (err) {
    console.error('Error uploading file to storage:', err);
    return null;
  }
}

/**
 * Delete all storage files for an exam (called on exam delete)
 */
export async function deleteExamFilesFromStorage(examId: string): Promise<void> {
  try {
    const { data: files } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(`exams/${examId}`);

    if (files && files.length > 0) {
      const paths = files.map(f => `exams/${examId}/${f.name}`);
      await supabase.storage.from(STORAGE_BUCKET).remove(paths);
    }
  } catch (err) {
    console.error('Error deleting exam files from storage:', err);
  }
}

// ─────────────────────────────────────────────
// Exams CRUD
// ─────────────────────────────────────────────

/**
 * Fetch all published exams from Supabase
 */
export async function fetchPublishedExams(): Promise<PublishedExam[]> {
  try {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .order('published_at', { ascending: false });

    if (error) {
      console.warn('Error fetching exams from Supabase:', error.message);
      return [];
    }

    if (!data) return [];

    return data.map((row: any): PublishedExam => ({
      id: row.id,
      title: row.title,
      questions: row.questions || [],
      settings: row.settings || { durationMinutes: 30, enableDateRange: false, maxAttempts: 1 },
      publishedAt: row.published_at || new Date().toISOString(),
      questionCount: row.question_count || (row.questions?.length || 0),
      rawText: row.raw_text || undefined,
      sourceImage: row.source_image || undefined,
      sourceImages: row.source_images || undefined,
      sourceFileUrl: row.source_file_url || undefined
    }));
  } catch (err) {
    console.warn('Network error fetching exams from Supabase:', err);
    return [];
  }
}

/**
 * Save or update a published exam in Supabase
 */
export async function saveExamToSupabase(exam: PublishedExam): Promise<boolean> {
  try {
    const payload = {
      id: exam.id,
      title: exam.title,
      questions: exam.questions,
      settings: exam.settings,
      published_at: exam.publishedAt,
      question_count: exam.questionCount || exam.questions.length,
      raw_text: exam.rawText || null,
      source_image: exam.sourceImage || null,
      source_images: exam.sourceImages || [],
      source_file_url: (exam as any).sourceFileUrl || null
    };

    const { error } = await supabase
      .from('exams')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error('Failed to save exam to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Network error saving exam to Supabase:', err);
    return false;
  }
}

/**
 * Delete an exam from Supabase (also cleans up its storage files)
 */
export async function deleteExamFromSupabase(examId: string): Promise<boolean> {
  try {
    // Delete storage files first (submissions cascade-deleted by FK)
    await deleteExamFilesFromStorage(examId);

    const { error } = await supabase
      .from('exams')
      .delete()
      .eq('id', examId);

    if (error) {
      console.error('Failed to delete exam from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Network error deleting exam from Supabase:', err);
    return false;
  }
}

// ─────────────────────────────────────────────
// Submissions CRUD
// ─────────────────────────────────────────────

/**
 * Fetch all examinee submissions from Supabase
 */
export async function fetchSubmissions(): Promise<ExamSubmission[]> {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error) {
      console.warn('Error fetching submissions from Supabase:', error.message);
      return [];
    }

    if (!data) return [];

    return data.map((row: any): ExamSubmission => ({
      id: row.id,
      examId: row.exam_id,
      examTitle: row.exam_title || '',
      examineeName: row.examinee_name || 'مختبر',
      examineeIndex: row.examinee_index || 0,
      submittedAt: row.submitted_at || new Date().toISOString(),
      correctCount: row.correct_count || 0,
      wrongCount: row.wrong_count || 0,
      unansweredCount: row.unanswered_count || 0,
      totalQuestions: row.total_questions || 0,
      percentage: Number(row.percentage) || 0,
      timeSpentSeconds: row.time_spent_seconds || 0,
      answers: row.answers || {},
      scratchpads: row.scratchpads || {},
      attemptNumber: row.attempt_number || 1
    }));
  } catch (err) {
    console.warn('Network error fetching submissions from Supabase:', err);
    return [];
  }
}

/**
 * Save an examinee submission to Supabase
 */
export async function saveSubmissionToSupabase(submission: ExamSubmission): Promise<boolean> {
  try {
    const payload = {
      id: submission.id,
      exam_id: submission.examId,
      exam_title: submission.examTitle,
      examinee_name: submission.examineeName,
      examinee_index: submission.examineeIndex,
      submitted_at: submission.submittedAt,
      correct_count: submission.correctCount,
      wrong_count: submission.wrongCount,
      unanswered_count: submission.unansweredCount,
      total_questions: submission.totalQuestions,
      percentage: submission.percentage,
      time_spent_seconds: submission.timeSpentSeconds,
      answers: submission.answers,
      scratchpads: submission.scratchpads,
      attempt_number: submission.attemptNumber
    };

    const { error } = await supabase
      .from('submissions')
      .insert(payload);

    if (error) {
      console.error('Failed to save submission to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Network error saving submission to Supabase:', err);
    return false;
  }
}

/**
 * Delete a submission from Supabase
 */
export async function deleteSubmissionFromSupabase(submissionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('submissions')
      .delete()
      .eq('id', submissionId);

    if (error) {
      console.error('Failed to delete submission from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Network error deleting submission from Supabase:', err);
    return false;
  }
}
