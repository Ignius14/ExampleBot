import QRCode from "qrcode";

export const getPaymentUri = ({ method, address, amount }) => {
	const amountValue = Number.parseFloat(amount);
	const amountParam = Number.isFinite(amountValue)
		? `?amount=${amountValue}`
		: "";

	switch (method) {
		case "btc":
			return `bitcoin:${address}${amountParam}`;
		case "ltc":
			return `litecoin:${address}${amountParam}`;
		case "eth":
			return `ethereum:${address}${amountParam}`;
		default:
			return address;
	}
};

export const generateQrBuffer = (text) =>
	QRCode.toBuffer(text, {
		type: "png",
		errorCorrectionLevel: "M",
		width: 256,
	});
