const loadSettingsFromDb = async () => {
if (!supabase) return;

            // Use the currently authenticated user to scope settings.
            // Assuming the user's ID acts as the merchant_id for this single-tenant app.
const { data: { user } } = await supabase.auth.getUser();
            const merchantId = user?.user_metadata?.merchant_id || user?.id;

if (!merchantId) {
                // Not logged in as a user who can have settings, rely on localStorage/defaults.
return;
}

if (dbSettings.branding) setBranding(dbSettings.branding);
if (dbSettings.integration) setIntegration(dbSettings.integration);
if (dbSettings.textSize) setTextSize(dbSettings.textSize);
if (dbSettings.pushAlertsEnabled !== undefined) setPushAlertsEnabled(dbSettings.pushAlertsEnabled);
if (dbSettings.pinnedReports) setPinnedReports(dbSettings.pinnedReports);
}

// Also persist the entire settings state to Supabase
if (!supabase) return;
const { data: { user } } = await supabase.auth.getUser();
const merchantId = user?.user_metadata?.merchant_id || user?.id;
if (!merchantId) return;

const settingsBlob = {
};

throw new Error("useSettings must be used within a SettingsProvider");
}
return context;
};