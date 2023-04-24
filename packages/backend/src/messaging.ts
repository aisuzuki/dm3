import { Socket } from 'socket.io';
import express from 'express';
import { WithLocals } from './types';
import { validateSchema } from 'dm3-lib-shared/dist.backend';
import { EncryptionEnvelop } from 'dm3-lib-messaging/dist.backend';
import { normalizeEnsName } from 'dm3-lib-profile/dist.backend';
import {
    schema,
    checkToken,
    incomingMessage,
} from 'dm3-lib-delivery/dist.backend';
const pendingMessageSchema = {
    type: 'object',
    properties: {
        ensName: { type: 'string' },
        contactEnsName: { type: 'string' },
        token: { type: 'string' },
    },
    required: ['ensName', 'contactEnsName', 'token'],
    additionalProperties: false,
};

export function onConnection(app: express.Application & WithLocals) {
    return (socket: Socket) => {
        socket.on('disconnect', () => {
            app;
            app.locals.logger.info({
                method: 'WS DISCONNECT',
                socketId: socket.id,
            });
        });

        socket.on(
            'submitMessage',
            async (
                data: {
                    envelop: EncryptionEnvelop;
                    token: string;
                },
                callback,
            ) => {
                try {
                    app.locals.logger.info({
                        method: 'WS INCOMING MESSAGE',
                    });

                    const isSchemaValid = validateSchema(
                        schema.MessageSubmission,
                        data,
                    );

                    if (!isSchemaValid) {
                        const error = 'invalid schema';

                        app.locals.logger.warn({
                            method: 'WS SUBMIT MESSAGE',
                            error,
                        });
                        return callback({ error });
                    }

                    await incomingMessage(
                        data,
                        app.locals.keys.signing,
                        app.locals.keys.encryption,
                        app.locals.deliveryServiceProperties.sizeLimit,
                        app.locals.db.getSession,
                        app.locals.db.createMessage,
                        (socketId: string, envelop: EncryptionEnvelop) => {
                            app.locals.io.sockets
                                .to(socketId)
                                .emit('message', envelop);
                        },
                        app.locals.web3Provider,
                        app.locals.db.getIdEnsName,
                    ),
                        callback({ response: 'success' });
                } catch (error: any) {
                    app.locals.logger.warn({
                        method: 'WS SUBMIT MESSAGE',
                        error: (error as Error).toString(),
                    });
                    return callback({ error: error.message });
                }
            },
        );

        socket.on('pendingMessage', async (data, callback) => {
            const isSchemaValid = validateSchema(pendingMessageSchema, data);

            if (!isSchemaValid) {
                const error = 'invalid schema';

                app.locals.logger.warn({
                    method: 'WS PENDING MESSAGE',
                    error,
                });

                return callback({ error });
            }

            let idEnsName: string;
            let idContactEnsName: string;
            const ensName = normalizeEnsName(data.ensName);
            const contactEnsName = normalizeEnsName(data.contactEnsName);

            try {
                idEnsName = await app.locals.db.getIdEnsName(ensName);
                idContactEnsName = await app.locals.db.getIdEnsName(
                    contactEnsName,
                );
            } catch (error) {
                app.locals.logger.warn({
                    method: 'WS PENDING MESSAGE',
                    error,
                });

                return callback({ error });
            }

            app.locals.logger.info({
                method: 'WS PENDING MESSAGE',
                ensName,
                contactEnsName,
            });
            try {
                if (
                    !(await checkToken(
                        app.locals.web3Provider,
                        app.locals.db.getSession,
                        idEnsName,
                        data.token,
                    ))
                ) {
                    const error = 'Token check failed';
                    app.locals.logger.warn({
                        method: 'WS PENDING MESSAGE',
                        error,
                    });
                    return callback({ error });
                }

                await app.locals.db.addPending(ensName, idContactEnsName);

                callback({ response: 'success' });
            } catch (error) {
                app.locals.logger.warn({
                    method: 'WS PENDING MESSAGE',
                    error: (error as Error).toString(),
                });

                return callback({ error: "Can't add pending message" });
            }
        });
    };
}
