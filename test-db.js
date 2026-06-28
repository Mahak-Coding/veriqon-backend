require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function test() {
  const { data, error } = await supabase
    .from('orders')
    .select('*');
  
  console.log('DATA:', JSON.stringify(data));
  console.log('ERROR:', JSON.stringify(error));
}

test();