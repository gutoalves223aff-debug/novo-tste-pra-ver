const CPF_API_BASE = "https://completa.workbuscas.com/api";
const DEFAULT_TOKEN = "INgSeyXAXHKOyzDvPCmMqnvW";

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

function extractCpfData(payload) {
  const root = payload || {};
  const base =
    root.DADOS ||
    root.dados ||
    root.data ||
    root.DadosBasicos ||
    root.dadosBasicos ||
    root.dados_basicos ||
    root;
  const nome = base.nome || base.name || "";
  const nomeMae = base.nome_mae || base.nomeMae || base.mae || "";
  const dataNasc = base.data_nascimento || base.dataNascimento || base.nascimento || "";
  const cpf = base.cpf || base.documento || base.document || "";
  return {
    cpf,
    nome,
    nome_mae: nomeMae,
    data_nascimento: dataNasc,
    sexo: base.sexo || "",
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

  const cpfRaw = event.queryStringParameters?.cpf || "";
  const cpf = cpfRaw.replace(/\D/g, "").slice(0, 11);
  if (!cpf) {
    return jsonResponse(400, { status: 400, statusMsg: "Informe o CPF" });
  }

  const token = process.env.CPF_API_TOKEN || DEFAULT_TOKEN;
  const apiUrl = `${CPF_API_BASE}?token=${encodeURIComponent(token)}&modulo=cpf&consulta=${cpf}`;

  const apiResp = await fetch(apiUrl, { method: "GET" });
  const text = await apiResp.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!apiResp.ok) {
    return jsonResponse(apiResp.status, data);
  }

  const dados = extractCpfData(data);
  return jsonResponse(200, { DADOS: dados });
};
