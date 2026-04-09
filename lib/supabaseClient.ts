import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://flbbfwlyaunxjnvjqoek.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsYmJmd2x5YXVueGpudmpxb2VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NDYyNTgsImV4cCI6MjA5MTEyMjI1OH0.GzOmQ6Ie2j2GxjyRwLf8iPNEhS6Vo3RKWwraRgN5D-eI"

export const supabase = createClient(supabaseUrl, supabaseKey)
