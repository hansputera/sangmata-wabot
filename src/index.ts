import avvio from 'avvio';
import consola from 'consola';
import { WhatsAppBot } from './applications/whatsapp-bot.js';
import { RestApi } from './applications/rest.js';

const app = avvio();

app.use(WhatsAppBot).use(RestApi);
app.ready((err) => {
	if (err) {
		throw err;
	}

	consola.info('Applications are ready!');
});

app.start();
