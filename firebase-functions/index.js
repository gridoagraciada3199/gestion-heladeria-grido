const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

exports.enviarPushNuevoAviso = onDocumentCreated(
  { document: "avisos/{avisoId}", region: "us-central1" },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const aviso = snapshot.data();
    if (!aviso) return;

    const db = getFirestore();
    const tokensSnapshot = await db.collection("tokensFCM").get();

    const tokens = [];
    const tokenDocs = [];

    tokensSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data && data.token && data.modo !== "prueba") {
        tokens.push(data.token);
        tokenDocs.push(doc.ref);
      }
    });

    if (tokens.length === 0) return;

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: aviso.titulo || "Nuevo aviso - Gestión Grido",
        body: aviso.contenido || "Tenés un nuevo aviso.",
      },
      data: {
        url: "./",
        avisoId: event.params.avisoId,
        prioridad: aviso.prioridad || "normal",
        tag: "aviso-" + event.params.avisoId,
        urgent: aviso.prioridad === "urgente" ? "true" : "false",
      },
      webpush: {
        fcmOptions: {
          link: "./",
        },
      },
    });

    const eliminaciones = [];
    response.responses.forEach((result, index) => {
      if (!result.success) {
        const code = result.error?.code || "";
        if (
          code.includes("registration-token-not-registered") ||
          code.includes("invalid-registration-token")
        ) {
          eliminaciones.push(tokenDocs[index].delete());
        }
      }
    });

    if (eliminaciones.length) await Promise.all(eliminaciones);

    await snapshot.ref.set(
      {
        pushEnviado: true,
        pushEnviadoEn: FieldValue.serverTimestamp(),
        pushEnviados: response.successCount,
        pushFallidos: response.failureCount,
      },
      { merge: true }
    );
  }
);
