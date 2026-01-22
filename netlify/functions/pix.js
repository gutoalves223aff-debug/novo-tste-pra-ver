const ASSET_URL = "https://api.assetpagamentos.com/functions/v1/transactions";

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function normalizeAmount(rawAmount) {
  if (rawAmount == null) return { amountCents: 100, amountNum: 1 };
  if (typeof rawAmount === "string") {
    const cleaned = rawAmount.replace(/[^\d,.-]/g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    if (!Number.isFinite(n)) return { amountCents: 100, amountNum: 1 };
    return { amountCents: Math.max(1, Math.round(n * 100)), amountNum: n };
  }
  const n = Number(rawAmount);
  if (!Number.isFinite(n)) return { amountCents: 100, amountNum: 1 };
  if (Number.isInteger(n) && n >= 1000) {
    const num = n / 100;
    return { amountCents: Math.max(1, Math.round(num * 100)), amountNum: num };
  }
  return { amountCents: Math.max(1, Math.round(n * 100)), amountNum: n };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      },
      body: "",
    };
  }

  const secret = process.env.ASSET_SECRET_KEY;
  const companyId = process.env.ASSET_COMPANY_ID;
  if (!secret || !companyId) {
    return jsonResponse(500, { success: false, error: "Configure ASSET_SECRET_KEY e ASSET_COMPANY_ID nas variaveis do Netlify" });
  }

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    body = {};
  }

  const randDigits = (len) => Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join("");
  const randId = randDigits(6);
  const rawAmount = body.amount ?? body.valor ?? body.total ?? 1;
  const { amountCents, amountNum } = normalizeAmount(rawAmount);
  const customerName = (body.nome || body.name || body.customer_name || `Cliente ${randId}`).toString();
  const customerEmail = (body.email || body.customer_email || `cliente${randId}@example.com`).toString();
  const customerPhone = (body.phone || body.customer_phone || `11${randDigits(9)}`).toString().replace(/\D/g, "");
  const cpfRaw = (body.cpf || body.document || body.customer_cpf || randDigits(11)).toString().replace(/\D/g, "");
  const customerCpf = cpfRaw.padEnd(11, "0").slice(0, 11);
  const tracking = (body.tracking || body.rastreio || body.codigo || `pedido-${randId}`).toString();
  const description = "Assinatura Digital";

  const payload = {
    paymentMethod: "PIX",
    amount: amountCents,
    companyId,
    description: `${description} ${tracking}`,
    postbackUrl: process.env.POSTBACK_URL || undefined,
    customer: {
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      document: customerCpf,
    },
    shipping: {
      neighborhood: body.neighborhood || "Centro",
      zipCode: body.zipCode || "01001000",
      city: body.city || "Sao Paulo",
      complement: body.complement || "",
      streetNumber: body.streetNumber || "1",
      street: body.street || "Rua Exemplo",
      state: body.state || "SP",
      country: "BR",
    },
    pix: {
      expiresInDays: 1,
    },
    items: [
      {
        title: description,
        unitPrice: amountCents,
        quantity: 1,
        externalRef: `pay-${Date.now()}`,
      },
    ],
    metadata: {
      tracking,
      nome: customerName,
      cpf: customerCpf,
      generated_at: new Date().toISOString(),
      original_body: body,
    },
  };

  const basic = Buffer.from(`${secret}:${companyId}`).toString("base64");
  const assetResp = await fetch(ASSET_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${basic}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await assetResp.text();
  if (!assetResp.ok) {
    return jsonResponse(assetResp.status, { success: false, error: text || "Erro ao criar PIX" });
  }

  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }

  const pixData = data?.pix || {};
  const brcode =
    pixData?.brcode ||
    pixData?.payload ||
    pixData?.qr_code ||
    pixData?.qrcode ||
    data?.brcode ||
    data?.payload ||
    data?.qrcode ||
    null;
  const qrcodeFinal = pixData?.qrcode || pixData?.qr_code || pixData?.payload || brcode;
  const paymentId = data?.id || data?.transactionId || null;

  return jsonResponse(200, {
    success: true,
    pix_code: brcode,
    transaction_id: paymentId,
    deposit_id: paymentId,
    qrcode: qrcodeFinal,
    amount: amountNum,
    key: pixData?.key || data?.key || null,
    brcode,
    payload: brcode,
    pixCode: brcode,
    pix: {
      key: pixData?.key || data?.key || null,
      brcode,
      qrcode: qrcodeFinal,
      payload: brcode,
    },
    raw: data,
  });
};
