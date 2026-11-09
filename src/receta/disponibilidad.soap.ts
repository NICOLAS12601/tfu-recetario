import type { Server } from 'node:http';
import * as soap from 'soap';
import type { RecetaService } from './receta.service.js';

/**
 * Migración REST -> SOAP de "verificar disponibilidad". Reusa la misma
 * lógica (RecetaService.verificarDisponibilidad); SOAP es solo otro
 * contrato. La librería `soap` atiende /ws (y /ws?wsdl) y le pasa el
 * resto de las rutas a Nest.
 */
export function publicarServicioSoap(servidor: Server, recetaService: RecetaService) {
  const servicio = {
    DisponibilidadService: {
      DisponibilidadPort: {
        async consultarDisponibilidad({ recetaId }: { recetaId: string }) {
          try {
            const { disponible, faltantes } =
              await recetaService.verificarDisponibilidad(recetaId);
            return {
              recetaId,
              disponible,
              faltante: faltantes.map((f) => ({
                productoId: f.productoId,
                nombre: f.nombre,
                cantidadFaltante: f.faltante,
              })),
            };
          } catch {
            // Receta inexistente: error del cliente, no se reintenta.
            throw {
              Fault: {
                faultcode: 'soap:Client',
                faultstring: `Receta ${recetaId} no existe`,
                statusCode: 404,
              },
            };
          }
        },
      },
    },
  };
  const ubicacion = process.env.SOAP_URL ?? 'http://localhost:8081/ws';
  soap.listen(servidor, '/ws', servicio, wsdl(ubicacion));
}

// Contrato del servicio (lo que devuelve GET /ws?wsdl).
const NS = 'http://recetario.tfu/disponibilidad';
const wsdl = (ubicacion: string) => `<?xml version="1.0" encoding="UTF-8"?>
<definitions name="DisponibilidadService" targetNamespace="${NS}"
  xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
  xmlns:tns="${NS}" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <types>
    <xsd:schema targetNamespace="${NS}" elementFormDefault="qualified">
      <xsd:element name="consultarDisponibilidadRequest">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="recetaId" type="xsd:string"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
      <xsd:complexType name="Faltante"><xsd:sequence>
        <xsd:element name="productoId" type="xsd:string"/>
        <xsd:element name="nombre" type="xsd:string"/>
        <xsd:element name="cantidadFaltante" type="xsd:int"/>
      </xsd:sequence></xsd:complexType>
      <xsd:element name="consultarDisponibilidadResponse">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="recetaId" type="xsd:string"/>
          <xsd:element name="disponible" type="xsd:boolean"/>
          <xsd:element name="faltante" type="tns:Faltante" minOccurs="0" maxOccurs="unbounded"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </types>
  <message name="consultarDisponibilidadInput">
    <part name="parameters" element="tns:consultarDisponibilidadRequest"/>
  </message>
  <message name="consultarDisponibilidadOutput">
    <part name="parameters" element="tns:consultarDisponibilidadResponse"/>
  </message>
  <portType name="DisponibilidadPortType">
    <operation name="consultarDisponibilidad">
      <input message="tns:consultarDisponibilidadInput"/>
      <output message="tns:consultarDisponibilidadOutput"/>
    </operation>
  </portType>
  <binding name="DisponibilidadBinding" type="tns:DisponibilidadPortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="consultarDisponibilidad">
      <soap:operation soapAction="${NS}/consultarDisponibilidad"/>
      <input><soap:body use="literal"/></input>
      <output><soap:body use="literal"/></output>
    </operation>
  </binding>
  <service name="DisponibilidadService">
    <port name="DisponibilidadPort" binding="tns:DisponibilidadBinding">
      <soap:address location="${ubicacion}"/>
    </port>
  </service>
</definitions>`;
