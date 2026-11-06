#!/usr/bin/env python3
"""Real TCP/UDP endpoints for the isolated operator lab (no shell/execution API)."""
import argparse,json,socket,threading,sys

def response(data,peer):
    request=json.loads(data)
    return json.dumps({'token':request['token'],'peer_ip':peer[0],'peer_port':peer[1]}).encode()+b'\n'

def serve():
    sockets=[]
    def tcp(listener):
        while True:
            connection,peer=listener.accept()
            with connection:
                connection.settimeout(2)
                try:connection.sendall(response(connection.recv(4096),peer))
                except (OSError,ValueError,KeyError):pass
    def udp(listener):
        while True:
            data,peer=listener.recvfrom(4096)
            try:listener.sendto(response(data,peer),peer)
            except (OSError,ValueError,KeyError):pass
    for protocol,ports in [('tcp',(8000,8002)),('udp',(8001,8003))]:
        for port in ports:
            s=socket.socket(socket.AF_INET,socket.SOCK_STREAM if protocol=='tcp' else socket.SOCK_DGRAM)
            s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);s.bind(('198.18.0.2',port))
            if protocol=='tcp':s.listen(16)
            sockets.append(s);threading.Thread(target=tcp if protocol=='tcp' else udp,args=(s,),daemon=True).start()
    print(json.dumps({'ready':True,'tcp':[8000,8002],'udp':[8001,8003]}),flush=True)
    threading.Event().wait()

def request(a):
    with socket.socket(socket.AF_INET,socket.SOCK_STREAM if a.protocol=='tcp' else socket.SOCK_DGRAM) as s:
        s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);s.settimeout(1.5)
        s.bind(('0.0.0.0',a.source_port));s.connect(('198.18.0.2',a.port));s.sendall(json.dumps({'token':a.token}).encode()+b'\n')
        result=json.loads(s.recv(4096))
        if result.get('token')!=a.token:raise ValueError('Endpoint token mismatch')
        print(json.dumps(result),flush=True)

def main():
    p=argparse.ArgumentParser();p.add_argument('mode',choices=['serve','request']);p.add_argument('--protocol',choices=['tcp','udp'],default='tcp');p.add_argument('--port',type=int,default=8000);p.add_argument('--source-port',type=int,default=0);p.add_argument('--token',default='aglab');a=p.parse_args()
    try:
        if a.mode=='serve':serve()
        else:request(a)
        return 0
    except (OSError,ValueError,KeyError) as error:
        print(json.dumps({'error_type':type(error).__name__,'error':str(error)}),flush=True);return 2
if __name__=='__main__':sys.exit(main())
