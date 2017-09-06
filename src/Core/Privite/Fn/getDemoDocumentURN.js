define(function() {;
    'use strict'
    // Return a default document URN for demo purpose.
    return function () {
        var documentId;

        switch (avp.env) {
            case "Development":
                //documentId = "urn:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Y29sdW1idXMvTWljaGFlbF9IYW5kLV8tYjE0MDk3ODQxNzcwMDZSQ0Nhci5kd2Y";
                documentId = "urn:dXJuOmFkc2suYTM2MGJldGFkZXY6ZnMuZmlsZTplbnRlcnByaXNlLmxtdnRlc3QuRFM1YTczMFFUYmYwMDIyZDA3NTFhYmE5MjZlZDZkMjJlZDY0P3ZlcnNpb249MQ==";
                break;
            case "Staging":
                documentId = "urn:dXJuOmFkc2suczM6ZGVyaXZlZC5maWxlOlZpZXdpbmdTZXJ2aWNlVGVzdEFwcC91c2Vycy9NaWNoYWVsX0hhbicvTU0zNTAwQXNzZW1ibHkuZHdm";
                break;
            case "Production":
                documentId = "FIXME";
                break;
            default:
                //documentId = "urn:dXJuOmFkc2suczM6ZGVyaXZlZC5maWxlOlZpZXdpbmdTZXJ2aWNlVGVzdEFwcC91c2Vycy9NaWNoYWVsX0hhbmAvUkMgQ2FyLmR3Zg"
                documentId = "https://lmv.rocks/viewer/data/gears/output/bubble.json";
        }

        return documentId;
    };
});