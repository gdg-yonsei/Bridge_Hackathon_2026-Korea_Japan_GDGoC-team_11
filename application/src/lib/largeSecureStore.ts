import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';

/**
 * SecureStore 2048바이트 제한 우회용 스토리지.
 * - 암호화 키: SecureStore (소용량, OS 키체인 보호)
 * - 실제 데이터: AES-CTR 암호화 후 AsyncStorage (대용량 가능)
 *
 * 민감한 데이터(토큰, 세션 등)를 저장할 때 사용하세요.
 */
export class LargeSecureStore {
  private async getEncryptionKey(keyName: string): Promise<Uint8Array> {
    let encryptionKeyHex = await SecureStore.getItemAsync(keyName);
    if (!encryptionKeyHex) {
      const key = crypto.getRandomValues(new Uint8Array(32)); // 256-bit
      encryptionKeyHex = aesjs.utils.hex.fromBytes(key);
      await SecureStore.setItemAsync(keyName, encryptionKeyHex);
    }
    return aesjs.utils.hex.toBytes(encryptionKeyHex);
  }

  async getItem(key: string): Promise<string | null> {
    const encryptedHex = await AsyncStorage.getItem(key);
    if (!encryptedHex) return null;

    const encryptionKey = await this.getEncryptionKey(`key_${key}`);
    const encryptedBytes = aesjs.utils.hex.toBytes(encryptedHex);
    const aesCtr = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const decryptedBytes = aesCtr.decrypt(encryptedBytes);
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = await this.getEncryptionKey(`key_${key}`);
    const valueBytes = aesjs.utils.utf8.toBytes(value);
    const aesCtr = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = aesCtr.encrypt(valueBytes);
    await AsyncStorage.setItem(key, aesjs.utils.hex.fromBytes(encryptedBytes));
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(`key_${key}`);
  }
}

export const largeSecureStore = new LargeSecureStore();
