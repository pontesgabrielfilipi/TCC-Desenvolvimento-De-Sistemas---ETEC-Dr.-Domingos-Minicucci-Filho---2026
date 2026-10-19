import asyncio
import json
import unittest

import pandas as pd

from api import main


class ApiNormalizationTest(unittest.TestCase):
    def test_normaliza_acentos_e_aliases_do_backend(self):
        data = pd.DataFrame([{
            "customer_city": " São Paulo ",
            "seller_city": "Botucatu",
            "product_category_name": "livros",
        }])

        normalized = main.normalizar_strings(data)

        self.assertEqual("sao paulo", normalized.loc[0, "customer_city"])
        self.assertEqual("botucatu", normalized.loc[0, "seller_city"])
        self.assertEqual(
            "livros_interesse_geral",
            normalized.loc[0, "product_category_name"],
        )

    def test_health_nao_expoe_detalhe_interno_do_modelo(self):
        original_error = main.model_error
        try:
            main.model_error = "/private/path/model.pkl: permission denied"
            response = asyncio.run(main.health_check())
            body = json.loads(response.body)

            self.assertEqual(503, response.status_code)
            self.assertEqual("model artifacts unavailable", body["detail"])
            self.assertNotIn("/private/path", response.body.decode())
        finally:
            main.model_error = original_error


if __name__ == "__main__":
    unittest.main()
