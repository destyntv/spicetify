import unittest
from pathlib import Path

from app import build_command, validate_spotify_url


class SpotifyUrlTests(unittest.TestCase):
    def test_accepts_track_and_strips_tracking_query(self):
        value = "https://open.spotify.com/track/0123456789012345678901?si=tracking"
        self.assertEqual(
            validate_spotify_url(value),
            "https://open.spotify.com/track/0123456789012345678901",
        )

    def test_accepts_album_playlist_and_artist(self):
        for kind in ("album", "playlist", "artist"):
            with self.subTest(kind=kind):
                value = f"https://open.spotify.com/{kind}/0123456789012345678901"
                self.assertEqual(validate_spotify_url(value), value)

    def test_rejects_non_spotify_hosts_and_non_https(self):
        for value in (
            "http://open.spotify.com/track/0123456789012345678901",
            "https://example.com/track/0123456789012345678901",
            "https://open.spotify.com.evil.test/track/0123456789012345678901",
        ):
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_spotify_url(value)

    def test_rejects_invalid_resource_ids(self):
        with self.assertRaises(ValueError):
            validate_spotify_url("https://open.spotify.com/track/not-a-valid-id")

    def test_command_uses_fixed_arguments_and_output_path(self):
        command = build_command(
            "https://open.spotify.com/track/0123456789012345678901",
            Path("/music"),
        )
        self.assertEqual(
            command,
            [
                "spotdl",
                "download",
                "https://open.spotify.com/track/0123456789012345678901",
                "--output",
                "/music/",
            ],
        )


if __name__ == "__main__":
    unittest.main()
