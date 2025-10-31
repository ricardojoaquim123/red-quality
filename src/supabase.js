// PASSO 3.4 - ARQUIVO 'src/supabase.js'

// Importa a função "createClient" do "tradutor" que instalamos
import { createClient } from '@supabase/supabase-js'

// Pega as chaves secretas que guardamos no "cofre" (.env.local)
// O 'import.meta.env' é como o Vite (nosso "motor") lê aquele arquivo
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Cria a conexão do Supabase
// Esta variável 'supabase' será usada em TODO o nosso aplicativo
export const supabase = createClient(supabaseUrl, supabaseAnonKey)