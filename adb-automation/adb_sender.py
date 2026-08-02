import argparse
import sys
import time
import uiautomator2 as u2

def main():
    parser = argparse.ArgumentParser(description="Send WhatsApp message via ADB UIAutomator2")
    parser.add_argument("--phone", required=True, help="Recipient phone number (international format)")
    parser.add_argument("--message", required=True, help="Message text")
    args = parser.parse_args()

    phone = args.phone
    message = args.message

    print(f"Connecting to Android device via UIAutomator2...")
    try:
        # Connect to default device via USB/Wi-Fi
        d = u2.connect()
    except Exception as e:
        print(f"Error connecting to device: {e}", file=sys.stderr)
        sys.exit(1)

    # Wake up screen if off
    try:
        if not d.info.get('screenOn', True):
            print("Screen is off. Waking up...")
            d.screen_on()
            time.sleep(1)
            # Swipe up to unlock (assuming no password/pattern lock)
            d.swipe(0.5, 0.8, 0.5, 0.2, duration=0.25)
            time.sleep(1)
    except Exception as e:
        print(f"Warning: Failed to check or wake screen: {e}")

    print(f"Opening WhatsApp chat for: {phone}")
    # Use general VIEW intent to launch chat in WhatsApp
    intent_url = f"whatsapp://send?phone={phone}"
    try:
        d.shell(f"am start -a android.intent.action.VIEW -d \"{intent_url}\"")
    except Exception as e:
        print(f"Error launching intent: {e}", file=sys.stderr)
        sys.exit(1)

    # Wait for the chat screen to load
    print("Waiting for chat screen to load...")
    time.sleep(3.0)

    # Find the message input field
    # Search for resource ID containing id/entry or EditText class
    input_field = d(resourceIdMatches=".*id/entry")
    if not input_field.exists:
        input_field = d(className="android.widget.EditText")

    if not input_field.exists:
        print("Error: Message input field not found on screen.", file=sys.stderr)
        sys.exit(1)

    print("Typing message...")
    input_field.set_text(message)
    time.sleep(1.0)

    # Find and click the Send button
    # Search for resource ID ending with id/send, or description matching Send/Kirim
    send_btn = d(resourceIdMatches=".*id/send")
    if not send_btn.exists:
        send_btn = d(descriptionMatches="(?i)send|kirim")

    if send_btn.exists:
        print("Clicking Send button...")
        send_btn.click()
        time.sleep(1.5)
        print("Message sent successfully!")
    else:
        print("Error: Send button not found on screen.", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
