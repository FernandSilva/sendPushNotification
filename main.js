import { Client, Databases } from "node-appwrite";
import webpush from "web-push";

export default async ({ req, res, log, error }) => {
  log("📨 Received request");

  try {
    // ✅ Extract variables instead of raw body
    const title = req.variables?.title;
    const message = req.variables?.message;
    const icon = req.variables?.icon || "https://www.growbuddy.club/assets/icons/GrowB-192x192.jpeg";
    const url = req.variables?.url || "https://www.growbuddy.club";

    if (!title || !message) {
      return res.send("❌ Missing required title or message", 400);
    }

    log("📦 Variables received:", { title, message, icon, url });

    // Initialize Appwrite client
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);

    // Fetch subscriptions
    const response = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID,
      process.env.SUBSCRIPTIONS_COLLECTION_ID
    );

    const subscriptions = response.documents.map((doc) =>
      JSON.parse(doc.subscription)
    );

    webpush.setVapidDetails(
      "mailto:admin@growbuddy.club",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const payload = JSON.stringify({
      notification: {
        title,
        body: message,
        icon,
        data: { url }
      }
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(sub, payload).catch((err) => {
          error(`❌ Push failed for one sub: ${err.message}`);
        })
      )
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    log(`✅ Push sent to ${successCount} subscriptions`);

    return res.json({ success: true, sent: successCount });
  } catch (err) {
    error(`❌ Function failed: ${err.message}`);
    return res.send(`Error: ${err.message}`, 500);
  }
};
