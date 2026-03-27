import urllib.request
import json
import mimetypes

  boundary = 'boundary123'                                                                                                                                  
                                                            
  fields = [
      ('type', 'multiple_choice'),
      ('text', 'Hvilket land er dette?'),                                                                                                                   
      ('time_limit', '30'),
      ('speed_bonus', 'true'),                                                                                                                              
      ('order_index', '2'),                                 
      ('answers', json.dumps([{'text': 'Norge', 'is_correct': True}, {'text': 'Sverige', 'is_correct': False}]))                                            
  ]                                                                                                                                                         
                                                                                                                                                            
  body = b''                                                                                                                                                
  for name, value in fields:                                
      body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
                                                                                                                                                            
  with open('/Users/gard/Downloads/Nah_idwin.png', 'rb') as f:                                                                                              
      file_data = f.read()                                                                                                                                  
  body += f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="Nah_idwin.png"\r\nContent-Type: image/png\r\n\r\n'.encode()             
  body += file_data + b'\r\n'                                                                                                                               
  body += f'--{boundary}--\r\n'.encode()
                                                                                                                                                            
  req = urllib.request.Request(url, data=body, headers={'Content-Type': f'multipart/form-data; boundary={boundary}', 'Authorization': 'Bearer ' + token},   
  method='POST')                                                                                                                                            
  print(urllib.request.urlopen(req).read().decode())
