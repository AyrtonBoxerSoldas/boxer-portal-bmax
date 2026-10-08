const { logger } = require("../logger");

// Geocodifica um CEP (lat/lng) para o BMax Motor calcular distância até o lead —
// sem isso a revenda nunca aparece como "dentro do raio", mesmo cadastrada certo.
// Camada 1: BrasilAPI (tem coordenadas para a maioria dos CEPs). Camada 2 (fallback):
// Nominatim por cidade/estado — mais impreciso (centro da cidade), mas sempre resolve
// algo. Camada 3: cidade/estado informados pelo chamador, quando o CEP nem existe na
// BrasilAPI. Compartilhado por TODO caminho que grava em comercial_revendas_bmax
// (Gestão e criação de usuário) — achado 07/10/2026: a criação de usuário não
// geocodificava, e a revenda nascia sem coordenada no Motor.

async function nominatimGeocode(params) {
    try {
        const qs = new URLSearchParams({ ...params, country: "Brazil", format: "json", limit: "1", countrycodes: "br" });
        const r = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
            headers: { "User-Agent": "BoxerPortalBMax/1.0 (boxersoldas.com.br)" },
            signal: AbortSignal.timeout(8000)
        });
        if (!r.ok) return null;
        const d = await r.json();
        if (!d.length) return null;
        return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
    } catch {
        return null;
    }
}

async function geocodeCep(cep, fallback = {}) {
    const clean = String(cep || "").replace(/\D/g, "");
    let cidade = null, estado = null;
    if (clean.length === 8) {
        try {
            const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${clean}`, { signal: AbortSignal.timeout(8000) });
            if (r.ok) {
                const d = await r.json();
                cidade = d.city || null;
                estado = d.state || null;
                const coords = d.location?.coordinates;
                if (coords?.latitude && coords?.longitude) {
                    return { lat: parseFloat(coords.latitude), lng: parseFloat(coords.longitude), cidade, estado };
                }
            }
        } catch (e) {
            logger.error({ message: "Erro ao geocodificar CEP via BrasilAPI", cep: clean, error: e.message });
        }
    }
    const cidadeBusca = cidade || fallback.cidade;
    const estadoBusca = estado || fallback.estado;
    if (cidadeBusca && estadoBusca) {
        const nom = await nominatimGeocode({ city: cidadeBusca, state: estadoBusca });
        if (nom) return { ...nom, cidade: cidadeBusca, estado: estadoBusca };
    }
    return { lat: null, lng: null, cidade, estado };
}

module.exports = { geocodeCep, nominatimGeocode };
