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

  let id = event.queryStringParameters?.id;
  if (event.httpMethod === "POST") {
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      id = body?.id || body?.paymentId || id;
    } catch {}
  }

  if (!id) {
    return jsonResponse(400, { success: false, error: "Informe o id" });
  }

  const basic = Buffer.from(`${secret}:${companyId}`).toString("base64");
  const statusResp = await fetch(`${ASSET_URL}/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${basic}`,
    },
  });

  const text = await statusResp.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }

  if (!statusResp.ok) {
    return jsonResponse(statusResp.status, { success: false, error: text || "Erro ao consultar pagamento" });
  }

  const status = data?.status || "pending";
  return jsonResponse(200, {
    success: true,
    id,
    status,
    paid: status === "paid" || status === "approved",
    raw: data,
  });
};
