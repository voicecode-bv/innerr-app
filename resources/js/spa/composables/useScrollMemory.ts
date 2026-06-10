/**
 * Onthoudt de scroll-positie van een pagina, gekoppeld aan een vrij te kiezen
 * sleutel (meestal de route-naam). De opslag leeft op module-niveau, dus de
 * waarde overleeft het unmounten/remounten van een component: tik je een post
 * aan en kom je via "terug" weer op de feed, dan kan de pagina herstellen waar
 * je gebleven was in plaats van naar boven te springen.
 *
 * Bewust géén Pinia-store: dit is pure UI-state zonder reactiviteit nodig — de
 * waarde wordt alleen geschreven bij verlaten en gelezen bij terugkeer.
 */
const positions = new Map<string, number>();

export function rememberScroll(key: string, top: number): void {
    positions.set(key, top);
}

export function recallScroll(key: string): number | undefined {
    return positions.get(key);
}

export function forgetScroll(key: string): void {
    positions.delete(key);
}
