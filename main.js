import { Client, Databases } from "node-appwrite";
import webpush from "web-push";

export default async ({ req, res, log, error }) => {
  log("📨 Received request");

  if (req.method !== "POST") {
    error("❌ Invalid request method: Only POST is accepted");
    return res.send("Method Not Allowed", 405);
  }

  try {
    const rawPayload = req.payload || req.body || "{}";
    const body = typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;

    log(`📦 Payload received: ${JSON.stringify(body)}`);

    const { title, message, icon, url } = body;

    if (!title || !message) {
      error("❌ Missing required fields: title or message");
      return res.send("Missing required title or message", 400);
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const dbId = process.env.APPWRITE_DATABASE_ID;
    const collectionId = process.env.SUBSCRIPTIONS_COLLECTION_ID;

    log(`📚 Fetching subscriptions from DB: ${dbId}, collection: ${collectionId}`);

    const response = await databases.listDocuments(dbId, collectionId);

    const subscriptions = response.documents
      .map((doc) => {
        try {
          return JSON.parse(doc.subscription);
        } catch (err) {
          error(`❌ Failed to parse subscription JSON: ${err.message}`);
          return null;
        }
      })
      .filter(Boolean);

    if (subscriptions.length === 0) {
      log("⚠️ No subscriptions found to send notifications to.");
      return res.send("No subscribers", 200);
    }

    webpush.setVapidDetails(
      "mailto:admin@growbuddy.club",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const notificationPayload = JSON.stringify({
      notification: {
        title,
        body: message,
        icon: icon || "https://www.growbuddy.club/assets/icons/GrowB-192x192.jpeg",
        data: {
          url: url || "https://www.growbuddy.club",
        },
      },
    });

    log(`🚀 Sending notifications to ${subscriptions.length} clients...`);
    let successCount = 0;
    let failureCount = 0;

    for (const sub of subscriptions) {
      try {
        log(`📤 Sending push to endpoint: ${sub.endpoint}`);
        await webpush.sendNotification(sub, notificationPayload); // This fails silently now
        log("✅ Notification sent successfully");
        successCount++;
      } catch (err) {
        failureCount++;
        error(`❌ Failed to send notification: ${err.message}`);
      }
    }
    

    log(`✅ Notifications sent: ${successCount}, ❌ Failed: ${failureCount}`);
    return res.json({ success: true, sent: successCount, failed: failureCount });
  } catch (err) {
    error(`❌ Unexpected failure: ${err.message}`);
    return res.send(`Error: ${err.message}`, 500);
  }
};
