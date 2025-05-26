import { Client, Databases } from "node-appwrite";
import webpush from "web-push";

export default async ({ req, res, log, error }) => {
  try {
    // Validate payload
    const { title, message, icon, url } = JSON.parse(req.body || "{}");
    if (!title || !message) {
      return res.send("Missing required title or message", 400);
    }

    // Initialize Appwrite client
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);

    // Fetch subscriptions from Appwrite
    const dbId = process.env.APPWRITE_DATABASE_ID;
    const collectionId = process.env.SUBSCRIPTIONS_COLLECTION_ID;

    const response = await databases.listDocuments(dbId, collectionId);

    const subscriptions = response.documents.map((doc) => JSON.parse(doc.subscription));

    // Configure web-push
    webpush.setVapidDetails(
      "mailto:admin@growbuddy.club",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    // Payload for push message
    const notificationPayload = JSON.stringify({
      notification: {
        title,
        body: message,
        icon: icon || "/assets/icons/GrowB-192x192.jpeg",
        data: { url: url || "https://www.growbuddy.club" }
      }
    });

    // Send notifications
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(sub, notificationPayload).catch((err) => {
          error(`❌ Failed for one subscription: ${err.message}`);
        })
      )
    );

    const successCount = results.filter(r => r.status === "fulfilled").length;
    log(`✅ Push sent to ${successCount} subscriptions`);

    return res.json({ success: true, sent: successCount });
  } catch (err) {
    error(`❌ Function failed: ${err.message}`);
    return res.send(`Error: ${err.message}`, 500);
  }
};
