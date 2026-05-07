import { supabase } from './supabase';

/**
 * Upload a photo to Supabase Storage and create a recipe_photos row.
 * Returns the public URL.
 */
export async function uploadRecipePhoto(opts: {
  file: File;
  recipeId: string;
  userId: string;
  photoType: 'hero' | 'step' | 'session';
  stepPosition?: number;
  noteId?: string;
  caption?: string;
}): Promise<string> {
  const { file, recipeId, userId, photoType } = opts;

  // Compress before upload (saves bandwidth + Supabase storage)
  const compressed = await compressImage(file, 1600, 0.85);

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${recipeId}/${photoType}-${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('recipe-images')
    .upload(path, compressed, { contentType: file.type, upsert: false });
  if (uploadErr) throw uploadErr;

  const { data: { publicUrl } } = supabase.storage
    .from('recipe-images')
    .getPublicUrl(path);

  // If this is the new hero, demote any existing hero
  if (photoType === 'hero') {
    await supabase
      .from('recipe_photos')
      .update({ photo_type: 'session' })
      .eq('recipe_id', recipeId)
      .eq('photo_type', 'hero');
  }

  await supabase.from('recipe_photos').insert({
    recipe_id: recipeId,
    user_id: userId,
    storage_path: path,
    photo_type: photoType,
    step_position: opts.stepPosition,
    note_id: opts.noteId,
    caption: opts.caption,
  });

  return publicUrl;
}

/**
 * Resize/compress an image client-side using a canvas.
 * Keeps aspect ratio, max dimension = maxSize, JPEG quality = quality.
 */
async function compressImage(file: File, maxSize: number, quality: number): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });

  let { width, height } = img;
  if (width > maxSize || height > maxSize) {
    if (width > height) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    } else {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob || file),
      'image/jpeg',
      quality
    );
  });
}

// ===== Notes helpers =====

export interface NoteInput {
  recipeId: string;
  userId: string;
  noteType: 'pinned' | 'session' | 'step';
  content: string;
  stepPosition?: number;
  rating?: number;
  cookedAt?: string; // YYYY-MM-DD
}

export async function addNote(n: NoteInput) {
  const { data, error } = await supabase
    .from('recipe_notes')
    .insert({
      recipe_id: n.recipeId,
      user_id: n.userId,
      note_type: n.noteType,
      content: n.content,
      step_position: n.stepPosition,
      rating: n.rating,
      cooked_at: n.cookedAt,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getRecipeNotes(recipeId: string) {
  const { data, error } = await supabase
    .from('recipe_notes')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getRecipePhotos(recipeId: string) {
  const { data, error } = await supabase
    .from('recipe_photos')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
