
function parseUsername(text) {
    const words = text.split(/\s+/);
    for (let i = words.length - 1; i >= 0; i--) {
        const cleaned = words[i].replace(/^[^a-zA-Z0-9_]+|[^a-zA-Z0-9_]+$/g, '');
        if (/^[a-zA-Z0-9_]{3,16}$/.test(cleaned)) {
            return cleaned;
        }
    }
    return null;
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

            const privateMatch = rawText.match(/\[.*?>\s*[Яя]\]\s*(.+)/);
            if (privateMatch) {
                const beforeYa = rawText.split(/>\s*[Яя]\]/)[0];
                const username = parseUsername(beforeYa);
                if (username) {
                    result = { type: 'private', username, message: privateMatch[1].trim() };
                }
            }

            if (!result && rawText.includes('Ⓛ')) {
                const arrowIndex = rawText.indexOf('⇨');
                if (arrowIndex !== -1) {
                    const beforeArrow = rawText.substring(0, arrowIndex);
                    const message = rawText.substring(arrowIndex + 1).trim();
                    const username = parseUsername(beforeArrow);
                    if (username) {
                        result = { type: 'chat', username, message };
                    }
                }
            }

            if (!result && rawText.includes('Ⓖ')) {
                const arrowIndex = rawText.indexOf('⇨');
                if (arrowIndex !== -1) {
                    const beforeArrow = rawText.substring(0, arrowIndex);
                    const message = rawText.substring(arrowIndex + 1).trim();
                    const username = parseUsername(beforeArrow);
                    if (username) {
                        result = { type: 'global', username, message };
                    }
                }
            }


            if (!result && rawText.includes('[Клан]')) {
                const clanMatch = rawText.match(/\[Клан\]\s*(\S+)\s*»\s*(.+)/);
                if (clanMatch) {
                    const username = clanMatch[1].replace(/^[^a-zA-Z0-9_]+|[^a-zA-Z0-9_]+$/g, '');
                    if (/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
                        result = { type: 'clan', username, message: clanMatch[2].trim() };
                    }
                }
            }

            if (result && result.username) {
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
