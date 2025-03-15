public class NewExampleUse {

public static void myCipherExample() {
    String exampleString = "This is a message";
    Cipher myCipher;
    try {
        // Insecure cipher mode: ECB
        myCipher = Cipher.getInstance("DES/ECB/PKCS5Padding");
        // No secure key
        myCipher.init(Cipher.ENCRYPT_MODE);

        // No initialization vector
        byte[] dataBytes = exampleString.getBytes();
        byte[] encryptedBytes = myCipher.doFinal(dataBytes);

        String encryptedString = Base64.encodeBase64String(encryptedBytes);
        System.out.println("Encrypted String: " + encryptedString);  
    } catch (Exception e) {
        e.printStackTrace();
    }
}
}