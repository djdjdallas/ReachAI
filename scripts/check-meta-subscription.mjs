import { createClient } from "@supabase/supabase-js";
import { decrypt } from "../src/lib/encryption.js";

const email = process.argv[2] || "highflyinnick@gmail.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from("users")
  .select("meta_page_access_token, instagram_business_account_id, email")
  .eq("email", email)
  .single();

if (error || !data) {
  console.error("User lookup failed:", error?.message || "not found");
  process.exit(1);
}

if (!data.meta_page_access_token) {
  console.error("No token stored for", email);
  process.exit(1);
}

let token;
try {
  token = decrypt(data.meta_page_access_token);
} catch (e) {
  console.error("Decrypt failed:", e.message);
  process.exit(1);
}

const url = "https://graph.instagram.com/v21.0/" + data.instagram_business_account_id + "/subscribed_apps?access_token=" + token;
const res = await fetch(url);
const json = await res.json();

console.log("Account: " + data.email);
console.log("IGBA:    " + data.instagram_business_account_id);
console.log("---");
console.log(JSON.stringify(json, null, 2));
