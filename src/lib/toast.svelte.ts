export interface Toast {
	id: number;
	message: string;
	tone: 'ok' | 'bad';
}

let items = $state<Toast[]>([]);
let nextId = 1;

/** Short confirmation messages shown in the corner of the screen. Browser only. */
export const toasts = {
	get items() {
		return items;
	},
	show(message: string, tone: Toast['tone'] = 'ok') {
		const id = nextId++;
		items.push({ id, message, tone });
		setTimeout(() => toasts.dismiss(id), tone === 'bad' ? 8000 : 4500);
	},
	dismiss(id: number) {
		items = items.filter((item) => item.id !== id);
	}
};
