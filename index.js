
function extractFromJson(jsonMsg) {
    const extra = jsonMsg?.extra || jsonMsg?.json?.extra || [];
    if (!extra.length) return null;

    let arrowIndex = -1;
    for (let i = 0; i < extra.length; i++) {
        const text = extra[i]?.text || '';
        if (text.includes('⇨')) {
            arrowIndex = i;
            break;
        }
    }

    if (arrowIndex === -1) return null;

    let username = null;
    for (let i = arrowIndex - 1; i >= 0; i--) {
        const text = extra[i]?.text || '';
        if (text.endsWith(' ')) {
            const cleaned = text.trim();
            if (/^[a-zA-Z0-9_]{3,16}$/.test(cleaned)) {
                username = cleaned;
                break;
            }
        }
    }

    let message = '';
    for (let i = arrowIndex + 1; i < extra.length; i++) {
        message += extra[i]?.text || '';
    }
    message = message.trim();

    return { username, message };
}

function extractClanFromJson(jsonMsg) {
    const extra = jsonMsg?.extra || jsonMsg?.json?.extra || [];
    if (!extra.length) return null;

    let sepIndex = -1;
    for (let i = 0; i < extra.length; i++) {
        const text = extra[i]?.text || '';
        if (text.includes('»')) {
            sepIndex = i;
            break;
        }
    }

    if (sepIndex === -1) return null;

    let username = null;
    for (let i = sepIndex - 1; i >= 0; i--) {
        const text = (extra[i]?.text || '').trim();
        const cleaned = text.replace(/^[^a-zA-Z0-9_]+|[^a-zA-Z0-9_]+$/g, '');
        if (/^[a-zA-Z0-9_]{3,16}$/.test(cleaned)) {
            username = cleaned;
            break;
        }
    }

    let message = '';
    for (let i = sepIndex; i < extra.length; i++) {
        const text = extra[i]?.text || '';
        if (i === sepIndex) {
            const afterSep = text.split('»')[1] || '';
            message += afterSep;
        } else {
            message += text;
        }
    }
    message = message.trim();

    return { username, message };
}

function extractPrivateFromJson(jsonMsg, rawText) {
    const extra = jsonMsg?.extra || jsonMsg?.json?.extra || [];
    if (!extra.length) return null;

    const privateMatch = rawText.match(/\[.*?>\s*[Яя]\]\s*(.+)/);
    if (!privateMatch) return null;

    let username = null;
    for (let i = extra.length - 1; i >= 0; i--) {
        const text = (extra[i]?.text || '').trim();
        if (text.includes('>') || text.includes('Я') || text.includes('я') || text === ']' || text === '[') continue;

        const cleaned = text.replace(/^[^a-zA-Z0-9_]+|[^a-zA-Z0-9_]+$/g, '');
        if (/^[a-zA-Z0-9_]{3,16}$/.test(cleaned)) {
            username = cleaned;
            break;
        }
    }

    return { username, message: privateMatch[1].trim() };
}

module.exports = (bot, options) => {
    const log = bot.sendLog;
    const settings = options.settings || {};

    if (bot.funtimeChatParserHandler) {
        bot.events.removeListener('core:raw_message', bot.funtimeChatParserHandler);
        log('[FunTimeParser] Старый обработчик удалён');
    }

    bot.messageQueue.registerChatType('chat', { prefix: '', delay: settings.localDelay || 3000 });
    bot.messageQueue.registerChatType('global', { prefix: '!', delay: settings.globalDelay || 3000 });
    bot.messageQueue.registerChatType('clan', { prefix: '/cc ', delay: settings.clanDelay || 500 });
    bot.messageQueue.registerChatType('private', { prefix: '/msg ', delay: settings.privateDelay || 3000 });
    log('[FunTimeParser] Типы чатов зарегистрированы');

    bot.funtimeChatParserHandler = (rawText, jsonMsg) => {
        try {
            if (!rawText.trim()) return;

            let result = null;

            if (rawText.includes('> Я]') || rawText.includes('> я]')) {
                const extracted = extractPrivateFromJson(jsonMsg, rawText);
                if (extracted?.username) {
                    result = { type: 'private', ...extracted };
                }
            }

            if (!result && rawText.includes('Ⓛ')) {
                const extracted = extractFromJson(jsonMsg);
                if (extracted?.username) {
                    result = { type: 'chat', ...extracted };
                }
            }

            if (!result && rawText.includes('Ⓖ')) {
                const extracted = extractFromJson(jsonMsg);
                if (extracted?.username) {
                    result = { type: 'global', ...extracted };
                }
            }

            // Клан чат
            if (!result && rawText.includes('[Клан]')) {
                const extracted = extractClanFromJson(jsonMsg);
                if (extracted?.username) {
                    result = { type: 'clan', ...extracted };
                }
            }

            if (result && result.username && result.message) {
                bot.events.emit('chat:message', { ...result, jsonMsg });
            }

        } catch (error) {
            log(`[FunTimeParser] Ошибка: ${error.message}`);
        }
    };

    bot.events.on('core:raw_message', bot.funtimeChatParserHandler);

    bot.once('end', () => {
        if (bot.funtimeChatParserHandler) {
            bot.events.removeListener('core:raw_message', bot.funtimeChatParserHandler);
            delete bot.funtimeChatParserHandler;
            log('[FunTimeParser] Обработчик выгружен');
        }
    });

    log('[FunTimeParser] Плагин загружен');
};
