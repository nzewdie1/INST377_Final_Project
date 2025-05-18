import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { city, savedAt } = req.body;

  if (!city || !savedAt) {
    return res.status(400).json({ error: 'Missing city or date' });
  }

  const { data, error } = await supabase
    .from('trips')
    .insert([{ city, saved_at: savedAt }]);

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ message: 'Trip saved!', data });
}
