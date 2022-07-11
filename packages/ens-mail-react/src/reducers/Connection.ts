import { ethers } from 'ethers';
import { Socket } from 'socket.io-client';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import * as Lib from 'ens-mail-lib';
import { ActionMap } from './shared';

export enum ConnectionType {
    ChangeConnectionState = 'CHANGE_CONNECTION_STATE',
    ChangeSocket = 'CHANGE_SOCKET',
    ChangeAccount = 'CHANGE_ACCOUNT',
    ChangeProvider = 'CHANGE_PROVIDER',
    ChangeStorageToken = 'CHANGE_STORAGE_TOKEN',
    ChangeStorageLocation = 'CHANGE_STORAGE_LOCATION',
    SetDefaultServiceUrl = 'SET_DEFAULT_SERVICE_URL',
}

type ConnectionPayload = {
    [ConnectionType.ChangeConnectionState]: Lib.ConnectionState;
    [ConnectionType.ChangeSocket]: Socket<DefaultEventsMap, DefaultEventsMap>;
    [ConnectionType.ChangeAccount]: Lib.Account;
    [ConnectionType.ChangeProvider]: ethers.providers.JsonRpcProvider;
    [ConnectionType.ChangeStorageToken]: string | undefined;
    [ConnectionType.ChangeStorageLocation]: Lib.StorageLocation;
    [ConnectionType.SetDefaultServiceUrl]: string;
};

export type ConnectionActions =
    ActionMap<ConnectionPayload>[keyof ActionMap<ConnectionPayload>];

export function connectionReducer(
    state: Lib.Connection,
    action: ConnectionActions,
): Lib.Connection {
    switch (action.type) {
        case ConnectionType.ChangeConnectionState:
            if (state.connectionState === action.payload) {
                return state;
            } else {
                Lib.log(
                    `[Connection] New connection state ${
                        Lib.ConnectionState[action.payload]
                    }`,
                );
                return {
                    ...state,
                    connectionState: action.payload,
                };
            }
        case ConnectionType.ChangeSocket:
            Lib.log(`[Connection] New socket`);
            return {
                ...state,
                socket: action.payload,
            };

        case ConnectionType.ChangeAccount:
            Lib.log(`[Connection] Set account ${action.payload.address}`);
            return {
                ...state,
                account: action.payload,
            };

        case ConnectionType.ChangeStorageLocation:
            if (state.storageLocation === action.payload) {
                return state;
            } else {
                Lib.log(
                    `[Connection] Set storage location to ${action.payload}`,
                );

                return {
                    ...state,
                    storageLocation: action.payload,
                };
            }
        case ConnectionType.ChangeProvider:
            Lib.log(`[Connection] Set provider`);
            return {
                ...state,
                provider: action.payload,
            };

        case ConnectionType.ChangeStorageToken:
            if (state.storageToken === action.payload) {
                return state;
            } else {
                Lib.log(`[Connection] Set sorage token`);
                return {
                    ...state,
                    storageToken: action.payload,
                };
            }

        case ConnectionType.SetDefaultServiceUrl:
            Lib.log(`[Connection] set default service url ${action.payload}`);
            return {
                ...state,
                defaultServiceUrl: action.payload,
            };

        default:
            return state;
    }
}