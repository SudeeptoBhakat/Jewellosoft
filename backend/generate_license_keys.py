from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def main():
    private_key = ec.generate_private_key(ec.SECP256R1())

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")

    print("=" * 70)
    print("PRIVATE KEY: edge function secret LICENSE_SIGNING_KEY (server only)")
    print("=" * 70)
    print(private_pem)
    print("=" * 70)
    print("PUBLIC KEY: config.json \"LICENSE_PUBLIC_KEY\" (safe to ship)")
    print("=" * 70)
    print(public_pem)
    print("For config.json, encode the public key as a single JSON string, e.g.:")
    print(f'  "LICENSE_PUBLIC_KEY": {public_pem_to_json(public_pem)!s}')


def public_pem_to_json(pem):
    import json
    return json.dumps(pem)


if __name__ == "__main__":
    main()
